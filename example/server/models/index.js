var Sequelize = require('sequelize');
var fs = require('fs');
var path = require('path');

var sequelize = new Sequelize('todos', null, null, {
  dialect: 'sqlite',
  storage: path.join(__dirname, '../db.sqlite')
});

var models = {};

fs.readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function(file) {
    var model = sequelize.import(path.join(__dirname, file));
    models[model.name] = model;
  });
 
Object.keys(models).forEach(function(model) {
  if ('associate' in models[model]) {
    models[model].associate(models);
  }
});

module.exports = {
  sequelize: sequelize,
  models: models
};
