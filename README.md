# sails-mongo-tree
A tree structure for sails-mongo (Waterline adapter) using the materialized path pattern

**Installations**

Install using
`npm install sails-mongo-tree --save`

**Integration**

In order to transform your model into a tree like structure add a **parent** attribute to your model

//api/models/User.js
`module.exports = {
  attributes: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    parent: { model: 'user' }
  }
}//The adapter will take care of the rest. All you need to do is to add a parent field in the attributes.
`
**Methods available**

Get Parent
`Model.getParent(childObject, callback<err, [parent]>)`

Get immediate children
`Model.getChildren(parentObject, callback<err, [children]>)`

Get all children and grand children
`Model.getAllChildren(parentObject, callback<err, [children]>)`

Get all ancestors including parent
`Model.getAncestors(child, callback<err, [ancestors]>)`
