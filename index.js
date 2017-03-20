var path = require('path')
var _ = require('lodash')
var MongoObjectId = require('sails-mongo/node_modules/mongodb').ObjectID;

module.exports = (function () {

    var treeObj =  {

        seed: function (schema) {

            function _getCallerFile() {
                try {
                    var err = new Error()
                    var callerfile
                    var currentfile
                    var pst = Error.prepareStackTrace

                    Error.prepareStackTrace = function (err, stack) {
                        return stack
                    }

                    currentfile = err.stack.shift().getFileName()

                    var files = err.stack.reverse().map( function(log) {
                        return log.getFileName()
                    })

                    Error.prepareStackTrace = pst //restore the class method

                    while (files.length) {
                        callerfile = files.shift()
                        if (currentfile !== callerfile && callerfile.indexOf('/api/models/') !== -1) return callerfile
                    }
                } catch (err) {
                    console.log(err)
                    return null
                }
                return null
            }

            var modelPath = _getCallerFile()

            if (!modelPath) {
                throw 'Unable to attach model. Make sure you are calling this from api/models/'
                return schema
            }

            var scriptName = path.basename(modelPath)
            var modelName = scriptName.replace('.js', '')

            var scriptName = path.basename(modelPath)
            var modelName = scriptName.replace('.js', '')
            modelName = modelName.toLowerCase()

            schema.attributes.parent = {model: modelName}

            schema.attributes.__path = {type: 'string'}

            var pathSeparator = '#'
            var selfId = '$'
            schema.attributes.path = function () {
                if (_.isString(this.__path))
                    return this.__path.replace(selfId, this.id)
                return null
            }

            var bfc = schema.breforeCreate
            schema.beforeCreate = function (values, cb) {
                //implementation here...
                if (!values.parent) {
                    values.__path = selfId
                    if (bfc) return bfc(values, cb)
                    return cb()
                }
                sails.models[modelName].findOne({id: values.parent}, function (err, parentDoc) {
                    if (err) return cb(err)
                    values.__path = parentDoc.path() + pathSeparator + selfId
                    if (bfc) return bfc(values, cb)
                    return cb()
                })
            }

            var bfu = schema.beforeUpdate
            schema.beforeUpdate = function (values, cb) {
                var end = function() {
                    if (bfu) return bfu(values, cb)
                    return cb()
                }
                var self = this
                sails.models[modelName].findOne({id: values.id}).populate('parent').exec(function (err, original) {
                    if (err) return cb(err)
                    var isParentChange = original.parent.id !== values.parent
                    if (isParentChange) {
                        if (!values.parent) {
                            values.__path = selfId
                            return end()
                        }

                        var previousPath = original.path()
                        values.__path = original.parent.path() + pathSeparator + original.id

                        if (isParentChange) {
                            // When the parent is changed we must rewrite all children paths as well
                            sails.models[modelName].find({__path: {startsWith: previousPath + pathSeparator}}, function (err, users) {
                                if (err) return cb(err)
                                users.forEach(function (user) {
                                    var newPath = values.__path + user.path().substr(previousPath.length)
                                    user.__path = newPath
                                    user.save()
                                })
                                return end()
                            })
                        }
                    } else {
                        return end()
                    }
                })
            }

            var bfd = schema.beforeDestroy
            schema.beforeDestroy = function (values, cb) {

                var end = function() {
                    if (bfd) return bfd(values, cb)
                    return cb()
                }

                var objectId = values.id ? values.id : (values.where) ? values.where.id : null
                if(!objectId) {
                    return end()
                }
                sails.models[modelName].native(function(err, collection) {
                    if (err) return cb(err)

                    collection.find({'_id': MongoObjectId(objectId)}).toArray(function(err, results) {
                        if (err) return cb(err)
                        if(!results || results.length == 0) return end()

                        var objectToDelete = results[0]
                        var path = _.isString(objectToDelete.__path) ? objectToDelete.__path.replace(selfId, objectToDelete._id) : null
                        if (!path) return end()
                        var pattern = "^" + path + pathSeparator
                        collection.remove({__path: {$regex: pattern}}, function (err) {
                            if (err) return cb(err)
                            return end()
                        })
                    })
                })
            }

            schema.attributes.getChildren = function (recursive, cb) {
                if (typeof(recursive) === "function") {
                    cb = recursive
                    recursive = false
                }
                var filter = recursive ? {__path: {startsWith: this.path() + pathSeparator}} : {parent: this.id}
                return sails.models[modelName].find().where(filter).exec(cb)
            }

            schema.attributes.getParent = function (cb) {
                return sails.models[modelName].findOne({id: this.parent}, cb)
            }

            var getAncestors = function (cb) {
                if (this.path()) {
                    var ids = this.path().split(pathSeparator)
                    ids.pop()
                } else {
                    cb()
                }
                return sails.models[modelName].find().where({id: ids}).exec(cb)
            }

            schema.attributes.getAnsestors = getAncestors
            schema.attributes.getAncestors = getAncestors

            schema.attributes.level = function () {
                if(this.path().length == 0) return 0
                var ids = this.path().split(pathSeparator)
                ids.pop()
                return ids.length
            }
            return schema
        }
    }
    return treeObj

})()
