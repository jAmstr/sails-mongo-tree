/**
 * Module Dependencies
 */
// ...
// e.g.
// var _ = require('lodash');
// var mysql = require('node-mysql');
// ...



/**
 * sails-mongo-tree
 *
 * Most of the methods below are optional.
 *
 * If you don't need / can't get to every method, just implement
 * what you have time for.  The other methods will only fail if
 * you try to call them!
 *
 * For many adapters, this file is all you need.  For very complex adapters, you may need more flexiblity.
 * In any case, it's probably a good idea to start with one file and refactor only if necessary.
 * If you do go that route, it's conventional in Node to create a `./lib` directory for your private submodules
 * and load them at the top of the file with other dependencies.  e.g. var update = `require('./lib/update')`;
 */

var Collection = require('../node_modules/sails-mongo/lib/collection');
var parseDefinition = Collection.prototype._parseDefinition;
Collection.prototype._parseDefinitionOriginal = parseDefinition
Collection.prototype._parseDefinition = function(definition) {
// /*

    if(definition.definition.parent) {

      definition.definition.__path = { type: 'string' }

        var pathSeparator = '#'
        var selfId = '$'
        definition.definition.path = function () {
            if(_.isString(this.__path))
                return this.__path.replace(selfId, this.id);
            return null;
        }

        var bfc = definition.definition.breforeCreate
        definition.definition.beforeCreate = function (values, cb) {
            //implementation here...
            if(!values.parent) {
                values.__path = selfId
                if (bfc) return bfc(values, cb)
                return cb()
            }
            this.findOne({ id : values.parent }, function(err, parentDoc) {
                if (err) return cb(err)
                values.__path = parentDoc.path() + pathSeparator + selfId
                if (bfc) return bfc(values, cb)
                return cb()
            })
        }

        var bfu = definition.definition.beforeUpdate
        definition.definition.beforeUpdate = function (values, cb) {
            //implementation here...
            var self = this;
            self.findOne({ id: values.id }).populate('parent').exec(function(err, original) {
                if(err) return cb(err)
                var isParentChange = original.parent !== values.parent
                if(isParentChange) {
                    if(!values.parent) {
                        values.__path = selfId;
                        if(bfu) return bfu(values, cb)
                        return cb()
                    }

                    var previousPath = original.path();
                    values.__path = original.parent.path() + pathSeparator + original.id;

                    if(isParentChange) {
                        // When the parent is changed we must rewrite all children paths as well
                        self.find({ __path : { startsWith: previousPath + pathSeparator}}, function (err, users) {
                            if(err) return cb(err)
                            users.forEach(function(user) {
                                var newPath = values.__path + user.path().substr(previousPath.length)
                                user.__path = newPath
                                user.save();
                            })
                            if(bfu) return bfu(values, cb)
                            return cb()
                        })
                    }
                } else {
                    if(bfu) return bfu(values, cb)
                    return cb()
                }
            });
        }

        var bfd = definition.definition.beforeDestroy
        definition.definition.beforeDestroy = function (values, cb) {

            var path = (_.isString(values.__path)) ? values.__path.replace(selfId, values.id):  null
            if(!path) {
                if(bfd) return bfd(values, cb)
                return cb()
            }
            this.remove({ __path : { startsWith: path + pathSeparator } }, function(err) {
                if(err) return cb(err)
                if(bfd) return bfd(values, cb)
                return cb()
            });
        }

        definition.definition.getChildren =  function(recursive, cb) {
            if(typeof(recursive) === "function") {
                cb = recursive
                recursive = false
            }
            var filter = recursive ? { path : { startsWith : this.path() + pathSeparator } } : { parent : this.id }
            return this.find(filter, cb)
        }

        definition.definition.getParent = function(cb) {
            return this.findOne({ id : this.parent }, cb)
        };

        var getAncestors = function(cb) {
            if(this.path()) {
                var ids = this.path().split(pathSeparator)
                ids.pop()
            } else {
                cb()
            }
            return this.find().where({ id: ids }).exec(cb);
        };

        definition.definition.getAnsestors = getAncestors
        definition.definition.getAncestors = getAncestors

        definition.definition.level = function() {
            return this.__path ? this.__path.split(pathSeparator).length : 0
        };

    }
// */

    this._parseDefinitionOriginal(definition)
}

var adapter = require('sails-mongo')
adapter.findJasim = function findJasim (connectionName, collectionName, data, cb) {

    adapter.find(connectionName, collectionName, data, cb)
}

module.exports = adapter
