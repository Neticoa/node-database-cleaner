var async = require('async');

var DatabaseCleaner = module.exports = function(type) {
  var cleaner = {};
  var config = require("../config/cleaner-config.js");

  cleaner['mongodb'] = function(db, callback) {
    db.collections(function(skip, collections) {
      var count = collections.length;
      if (count < 1) {
        return callback.apply();
      }

      collections.forEach(function(collection) {
        collection.drop(function() {
          if (--count <= 0 && callback) {
            callback.apply();
          }
        });
      });
    });
  };

  cleaner['redis'] = function(db, callback) {
    db.flushdb(function(err, results) {
      callback.apply();
    });
  };

  cleaner['couchdb'] = function(db, callback) {
    db.destroy(function(err, res) {
      db.create(function(err, res) {
        callback.apply();
      });
    });
  };

  cleaner['mysql'] = function(db, callback) {
    db.query('show tables', function(err, tables) {
      var count = 0;
      var length = tables.length;
      var tableName = 'Tables_in_' + db.config.database;
      var skippedTables = config.mysql.skipTables;

      tables.forEach(function(table) {
        if (skippedTables.indexOf(table[tableName]) === -1) {
          db.query("DELETE FROM " + table[tableName], function() {
            count++;
            if (count >= length) {
              callback.apply();
            }
          });
        } else {
          count++;
          if (count >= length) {
            callback.apply();
          }
        }
      });
    });
  };

 cleaner['postgresql'] = function(db, callback) {
    db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';", function(err, tables) {
      var skippedTables = config.postgresql.skipTables;
      async.map(tables.rows, function(table, cb) {
          if (skippedTables.indexOf(table['table_name']) === -1) {
              db.query("ALTER TABLE " + "\"" + table['table_name'] + "\" DISABLE TRIGGER ALL", function() {
                  db.query("DELETE FROM " + "\"" + table['table_name'] + "\" CASCADE", function() {
                      async.parallel([
                          function(done) {
                              db.query("ALTER TABLE " + "\"" + table['table_name'] + "\" ENABLE TRIGGER ALL", function() {
                                  done();
                              });
                          },
                          function(done) {
                              db.query("ALTER SEQUENCE IF EXISTS " + table['table_name'] + "_id_seq RESTART", function() {
                                  done();
                              });
                          }
                      ], function() {
                          cb();
                      });
                  });
              });
          } else {
              cb();
          }
      }, function() {
          callback.apply();
      });
    });
  };

  this.clean = function(db, callback) {
    cleaner[type](db, callback);
  };
};
