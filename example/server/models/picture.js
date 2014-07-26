module.exports = function(sequelize, DataTypes) {
  var Picture = sequelize.define('Picture', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV1,
      primaryKey: true
    },
    file: {
      type: DataTypes.STRING
    },
    caption: {
      type: DataTypes.STRING
    }
  }, {
    underscored: true,
    paranoid: true
  });
 
  return Picture;
};
