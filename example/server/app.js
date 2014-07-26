var PORT = process.env.PORT || 8080;

/**
 * Requires
 */
var express = require('express');
var path = require('path');
var sequelize = require('./models').sequelize;
var models = require('./models').models;
var bodyParser = require('body-parser');
var busboy = require('connect-busboy');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');

/**
 * Define Express application using body-parser to
 * extract data from an HTTP POST request.
 */
var app = express();
app.use('/', express.static(path.join(__dirname, '../client')));
app.use('/dist', express.static(path.join(__dirname, '../../dist')));
app.use('/bower_components', express.static(path.join(__dirname, '../../bower_components')));
app.use(bodyParser.json());
app.use(busboy());

/**
 * Routes
 */
var router = express.Router();
router.route('/todos')
  
  // GET /api/todos
  .get(function(req, res) {
    models.Todo
      .findAll({
        where: req.query
      })
      .success(function(todos) {
        res.json(todos);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // POST /api/todos
  .post(function(req, res) {
    models.Todo
      .create({
        title: req.body.title,
        completed: req.body.completed,
        order: req.body.order
      })
      .success(function(todo) {
        res.json(todo);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

router.route('/todos/:id')

  // GET /api/todos/:id
  .get(function(req, res) {
    models.Todo
      .find(req.params.id)
      .success(function(todo) {
        res.json(todo);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // PUT /api/todos/:id
  .put(function(req, res) {
    models.Todo
      .find(req.params.id)
      .success(function(todo) {
        if (todo) {
          todo
            .updateAttributes({
              title: req.body.title,
              completed: req.body.completed,
              order: req.body.order
            })
            .success(function(todo) {
              res.json(todo);
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }

        else {
          models.Todo
            .create({
              id: req.params.id,
              title: req.body.title,
              completed: req.body.completed,
              order: req.body.order
            })
            .success(function(todo) {
              res.json(todo);
            })
            .error(function(err) {
              // Case when this model cannot be created because
              // it has already been deleted.
              if (err.code === 'SQLITE_CONSTRAINT') {
                res.status(410).send(err);
              }
              
              else {
                res.status(500).send(err);
              }
            });
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // DELETE /api/todos/:id
  .delete(function(req, res) {
    models.Todo
      .find(req.params.id)
      .success(function(todo) {
        if (todo) {
          todo
            .destroy()
            .success(function() {
              res.json({ success: true });
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }

        else {
          res.status(404).send();
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

router.route('/user')

  // GET /api/user
  .get(function(req, res) {
    models.User
      .findAll()
      .success(function(users) {
        if (users.length > 0) {
          res.json(users[0]);
        }

        else {
          models.User
            .create({
              email: 'user@example.com',
              first_name: 'Example',
              last_name: 'User'
            })
            .success(function(user) {
              res.json(user);
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // PUT /api/user
  .put(function(req, res) {
    models.User
      .findAll()
      .success(function(users) {
        if (users.length > 0) {
          users[0]
            .updateAttributes({
              email: req.body.email,
              first_name: req.body.first_name,
              last_name: req.body.last_name
            })
            .success(function(user) {
              res.json(user);
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }

        else {
          models.User
            .create({
              email: req.body.email,
              first_name: req.body.first_name,
              last_name: req.body.last_name
            })
            .success(function(user) {
              res.json(user);
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

router.route('/pictures')
  
  // GET /api/pictures
  .get(function(req, res) {
    models.Picture
      .findAll({
        where: req.query
      })
      .success(function(pictures) {
        res.json(pictures);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // POST /api/pictures
  .post(function(req, res) {
    models.Picture
      .create({
        caption: req.body.caption
      })
      .success(function(picture) {
        res.json(picture);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

router.route('/pictures/:id')

  // GET /api/pictures/:id
  .get(function(req, res) {
    models.Picture
      .find(req.params.id)
      .success(function(picture) {
        res.json(picture);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // PUT /api/pictures/:id
  .put(function(req, res) {
    var createOrUpdate = function(callback) {
      models.Picture
        .find(req.params.id)
        .success(function(picture) {
          console.log(req.body);
          if (picture) {
            picture
              .updateAttributes({
                file: req.body.file || picture.file, // Only overwrite `file` if one was provided
                caption: req.body.caption
              })
              .success(function(picture) {
                if (typeof callback === 'function') {
                  callback(picture);
                } else {
                  res.json(picture);
                }
              })
              .error(function(err) {
                res.status(500).send(err);
              });
          }

          else {
            models.Picture
              .create({
                id: req.params.id,
                caption: req.body.caption
              })
              .success(function(picture) {
                if (typeof callback === 'function') {
                  callback(picture);
                } else {
                  res.json(picture);
                }
              })
              .error(function(err) {
                // Case when this model cannot be created because
                // it has already been deleted.
                if (err.code === 'SQLITE_CONSTRAINT') {
                  res.status(410).send(err);
                }
                
                else {
                  res.status(500).send(err);
                }
              });
          }
        })
        .error(function(err) {
          res.status(500).send(err);
        });
    };

    var contentType = req.headers['content-type'] || '';
    if (contentType.indexOf('multipart/form-data') !== 0) {
      createOrUpdate();
      return;
    }

    models.Picture
      .find(req.params.id)
      .success(function(picture) {
        var basePath = path.join(__dirname, './uploads/pictures', picture.id);

        req.busboy.on('file', function(field, file, name) {
          var filePath = path.join(basePath, field);
          mkdirp.sync(filePath);

          req.body[field] = name;
          
          file.pipe(fs.createWriteStream(path.join(filePath, name)));
        });
     
        req.busboy.on('finish', function() {
          createOrUpdate();
        });

        req.pipe(req.busboy);
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  })

  // DELETE /api/pictures/:id
  .delete(function(req, res) {
    models.Picture
      .find(req.params.id)
      .success(function(picture) {
        if (picture) {
          picture
            .destroy()
            .success(function() {
              res.json({ success: true });
            })
            .error(function(err) {
              res.status(500).send(err);
            });
        }

        else {
          res.status(404).send();
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

router.route('/pictures/:id/file')

  // GET /api/pictures/:id/file
  .get(function(req, res) {
    models.Picture
      .find(req.params.id)
      .success(function(picture) {
        if (!picture.file) {
          res.status(404).send();
          return;
        }

        var basePath = path.join(__dirname, './uploads/pictures', picture.id);
        var filePath = path.join(basePath, 'file', picture.file);

        if (fs.existsSync(filePath)) {
          res.sendFile(filePath);
        } else {
          res.status(404).send();
        }
      })
      .error(function(err) {
        res.status(500).send(err);
      });
  });

app.use('/api', router);

/**
 * Set up the database and start the server.
 */
console.log('=> Booting Connect');
sequelize
  .sync()
  .success(function() {
    app.listen(PORT);
    console.log('=> Express application starting in ' + app.settings.env +
      ' on http://0.0.0.0:' + PORT);
    console.log('=> Ctrl-C to shutdown server');
  })
  .error(function(err) {
    throw err[0];
  });
