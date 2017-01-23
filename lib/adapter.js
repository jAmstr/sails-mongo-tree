/**
 * Module Dependencies
 */
var adapter = require('sails-mongo')
var async = require("async");
var Collection = require('sails-mongo/lib/collection');
var Query = require('sails-mongo/lib/query');
var ObjectId = require('mongodb').ObjectID;
/**
 * sails-mongo-tree
 *
 * Most of the methods below are optional.
 *
 * If you don't need / can't get to every method, just implement
 * what you have time for.  The other methods will only fail if
 * you try to call them!
 *
 */

var pathSeparator = '#'
var selfId = '$'

var __parseDefinition = Collection.prototype._parseDefinition
Collection.prototype._parseDefinition = function(def) {

    var definition = _.cloneDeep(def);
    if(definition.definition.parent)
        definition.definition.__path = { type: 'string', defaultsTo: selfId }

    __parseDefinition.call(this, definition)
}

function path(obj) {
    if(obj.__path && obj.__path.length > 0)
        return obj.__path.replace(selfId, obj._id ? obj._id : (obj.id ? obj.id : ''));
    return '';
}

var __insert = Collection.prototype.insert
Collection.prototype.insert = function(values, cb) {

    if(!this.schema.parent)
        return __insert.call(this, values, cb)

    if(!values.parent) {
        values.__path = selfId
        return __insert.call(this, values, cb)
    }
    var self = this
    var collection = this.connection.db.collection(self.identity)
    collection.find({_id :  new ObjectId(values.parent)}).toArray(function(err, parentDocs) {
        if (err) return cb(err)
        var parentDoc = parentDocs.pop()
        values.__path = path(parentDoc) + pathSeparator + selfId
        return __insert.call(self, values, cb)
    })
}

var __update = Collection.prototype.update
Collection.prototype.update = function(criteria, values, cb) {

    if(!values.parent) {
        return __update.call(this, criteria ,values, cb)
    }
    var self = this
    var collection = this.connection.db.collection(self.identity)
    var newCriteria = {where: {or: [{id : values.parent}, criteria.where]}}

    var query
    try {
        query = new Query(newCriteria, self.schema, self.config)
    } catch(err) {
        return cb(err)
    }

    collection.find(query.criteria.where).toArray(function(err, items) {
        if(err || items.length == 0 ) return cb(err, err ? null : [])

        var child, newParent, item
        while(item = items.pop()) {
            if(item._id == values.parent)
                newParent = item
            else
                child = item
        }

        if(!child || !newParent)
            return __update.call(self, criteria ,values, cb)

        var isParentChange = newParent._id != child.parent
        var previousPath = path(child)
        values.__path = path(newParent) + pathSeparator + child._id.toString()

        if(isParentChange) {
            // When the parent is changed we must rewrite all children paths as well
            collection.find({ __path : { '$regex' : '^' + previousPath + pathSeparator }}).toArray(function (err, items) {
                if(err) return cb(err)
                items.forEach(function(item) {
                    var newPath = values.__path + path(item).substr(previousPath.length)
                    collection.update({ _id : new ObjectId(item._id) }, { $set : { __path : newPath } }, function(err) {
                        if(err) return cb(err);
                    });
                })
                return __update.call(self, criteria, values, cb)
            })
        } else
            return __update.call(self, criteria, values, cb)
    })
}

var __destroy = Collection.prototype.destroy
Collection.prototype.destroy = function(criteria, cb) {

    var self = this
    var query
    try {
        query = new Query(criteria, self.schema, self.config)
    } catch(err) {
        return cb(err)
    }
    if(!self.schema.parent)
        return __destroy.call(self, criteria, cb)

    var collection = this.connection.db.collection(self.identity)
    collection.find(query.criteria.where).toArray(function(err, items) {

        async.eachSeries(items, function(item, asyncCb){
            var _path = path(item)
            if(!_path || _path.length == 0)
                return asyncCb()
            collection.remove({ __path : { '$regex' : '^' + _path + pathSeparator }}, function(err) {
                asyncCb(err)
            })
        }, function done(err) {
            if(err)
                return cb(err)
            return __destroy.call(self, criteria, cb)
        })
    });
}

adapter.getParent = function (connectionName, collectionName, object, cb) {

    if(!object)
        return cb()
    if(!object.id || !object.parent)
        return cb()
    return adapter.find(connectionName, collectionName, {where: {id: object.parent}}, cb);
}
adapter.getChildren = function (connectionName, collectionName, object, cb) {

    if(!object)
        return cb()
    if(!object.id)
        return cb()
    return adapter.find(connectionName, collectionName, {where: { parent: object.id }}, cb);
}

adapter.getAllChildren = function (connectionName, collectionName, object, cb) {

    if(!object)
        return cb()
    if(!object.id || path(object).length == 0)
        return cb()

    return adapter.find(connectionName, collectionName, {where :{ __path : { startsWith : path(object) + pathSeparator }}}, cb);
}

var ancestors = function (connectionName, collectionName, object, cb) {

    if(!object)
        return cb()
    if(path(object).length == 0)
        return cb()
    var ids = path(object).split(pathSeparator)
    ids.pop()
    return adapter.find(connectionName, collectionName, {where: { id : ids }}, cb);
}

adapter.getAncestors = ancestors
adapter.getAnsestors = ancestors

var level = function(connectionName, collectionName, object, cb) {
    if(!object)
        return cb()
    if(path(object).length == 0)
        return cb()
    var ids = path(object).split(pathSeparator)
    ids.pop()
    cb(null, ids.length)
}

adapter.getLevel = level

module.exports = adapter