var path = require('path')
var _ = require('lodash')

module.exports = (function () {

    var treeObj =  {

        seed: function (schema) {

            function _getCallerFile() {
                try {
                    var err = new Error();
                    var callerfile;
                    var currentfile;

                    Error.prepareStackTrace = function (err, stack) {
                        return stack;
                    };

                    currentfile = err.stack.shift().getFileName();

                    var files = err.stack.reverse().map( function(log) {
                        console.log(log.getFileName())
                        return log.getFileName()
                    })

                    while (files.length) {
                        callerfile = files.shift()
                        if (currentfile !== callerfile && callerfile.indexOf('/api/models/') !== -1) return callerfile;
                    }
                } catch (err) {
                }
                return undefined;
            }

            var modelPath = _getCallerFile();

            if (!modelPath) {
                throw 'Unable to attach model. Make sure you are calling this from api/models/';
                return schema
            }

            var scriptName = path.basename(modelPath);
            var modelName = scriptName.replace('.js', '')

            var scriptName = path.basename(modelPath);
            var modelName = scriptName.replace('.js', '')
            modelName = modelName.toLowerCase()

            schema.attributes.parent = {model: modelName}

            schema.attributes.__path = {type: 'string'}

            var pathSeparator = '#'
            var selfId = '$'
            schema.attributes.path = function () {
                if (_.isString(this.__path))
                    return this.__path.replace(selfId, this.id);
                return null;
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
                //implementation here...
                var self = this;
                sails.models[modelName].findOne({id: values.id}).populate('parent').exec(function (err, original) {
                    if (err) return cb(err)
                    var isParentChange = original.parent.id !== values.parent
                    if (isParentChange) {
                        if (!values.parent) {
                            values.__path = selfId;
                            if (bfu) return bfu(values, cb)
                            return cb()
                        }

                        var previousPath = original.path();
                        values.__path = original.parent.path() + pathSeparator + original.id;

                        if (isParentChange) {
                            // When the parent is changed we must rewrite all children paths as well
                            sails.models[modelName].find({__path: {startsWith: previousPath + pathSeparator}}, function (err, users) {
                                if (err) return cb(err)
                                users.forEach(function (user) {
                                    var newPath = values.__path + user.path().substr(previousPath.length)
                                    user.__path = newPath
                                    user.save();
                                })
                                if (bfu) return bfu(values, cb)
                                return cb()
                            })
                        }
                    } else {
                        if (bfu) return bfu(values, cb)
                        return cb()
                    }
                });
            }

            var bfd = schema.beforeDestroy
            schema.beforeDestroy = function (values, cb) {

                var path = (_.isString(values.__path)) ? values.__path.replace(selfId, values.id) : null
                if (!path) {
                    if (bfd) return bfd(values, cb)
                    return cb()
                }
                sails.models[modelName].remove({__path: {startsWith: path + pathSeparator}}, function (err) {
                    if (err) return cb(err)
                    if (bfd) return bfd(values, cb)
                    return cb()
                });
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
            };

            var getAncestors = function (cb) {
                if (this.path()) {
                    var ids = this.path().split(pathSeparator)
                    ids.pop()
                } else {
                    cb()
                }
                return sails.models[modelName].find().where({id: ids}).exec(cb);
            };

            schema.attributes.getAnsestors = getAncestors
            schema.attributes.getAncestors = getAncestors

            schema.attributes.level = function () {
                if(this.path().length == 0) return 0
                var ids = this.path().split(pathSeparator)
                ids.pop()
                return ids.length
            };

            console.log(schema)
            return schema
        }
    }
    return treeObj

})()
