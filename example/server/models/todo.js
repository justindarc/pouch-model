module.exports = function(sequelize, DataTypes) {
  var Todo = sequelize.define('Todo', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      defaultValue: 'Enter a title'
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }
  }, {
    underscored: true,
    paranoid: true
  });
 
  return Todo;
};
