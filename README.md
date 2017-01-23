# sails-mongo-tree
A tree structure for sails-mongo (Waterline) using the materialized path pattern

**Installations**

Install using
`npm install sails-mongo-tree --save`

**Integration**

In order to transform your model into a tree like structure call **tree.seed()** and pass on your **schema** as argument

```
//api/models/User.js

var tree = require('sails-mongo-tree')

module.exports = tree.seed({
  attributes: {
    firstName: { type: 'string' },
    lastName: { type: 'string' }
  }
})
```

It adds a **parent** field and a **__path** field to your model. 
**parent** is a reference to the immediate parent and **__path** is used to implement the materialized path algorithm. 


**Attribute Methods available**

Get Parent

`model.getParent(function(err, parent){})`

Get immediate children

`model.getChildren(function(err, children){})`

Get all children and grand children

`model.getChildren(true, function(err, allChildren){})`


Get all ancestors including parent

`model.getAncestors(function(err, ancestors){})`

Get Level

`model.level()`
