/**
 * Sails.js plugin loader
 * Has to be used as config.moduleLoaderOverride
 * For now this won't work wit `sails lift`
 *
 * Lot's of the code is from sails moduleloader hook
 */


var path = require('path');
var async = require('async');
var _ = require('lodash');
var buildDictionary = require('sails-build-dictionary');

module.exports = function(sails) {

  return {
    configure: function() {
      sails.config.plugins = sails.config.plugins || {};
      sails.config.appPath = sails.config.appPath ? path.resolve(sails.config.appPath) : process.cwd();

      _.extend(sails.config.plugins, {
        pluginPaths: sails.config.plugins.pluginPaths || ['node_modules'],
        register: {},
        paths: {
          controllers: 'api/controllers',
          models: 'api/models',
        }
      });
    },

    initialize: function(cb) {

      // Expose self as `sails.modules` (for backwards compatibility)
      sails.modules = sails.hooks.moduleloader;

      var register = sails.config.plugins.register || {};

      async.eachSeries(sails.config.plugins.pluginPaths || [], function(folder, cb) {
        buildDictionary.optional({
          dirname: path.resolve(sails.config.appPath, folder),
          excludeDirs: /^\./,
          filter: /^(package\.json)$/,
          depth: 2
        }, function(err, modules) {
          if (err) {return cb(err);}

          _.extend(register, _.reduce(modules, function(memo, module, identity) {
            // Plugins need to have `sails.isPlugin` set to true
            if (module['package.json'] && module['package.json'].sails && module['package.json'].sails.isPlugin) {

              // Use identity as plugin name but with `sails-plugin` stripped off
              var pluginName = identity.match(/^sails-plugin-/) ? identity.replace(/^sails-plugin-/,'') : identity;

              if(register[pluginName]) {
                sails.log.warn('Plugin `' + register[pluginName].folder + '/' + pluginName + '` overriden /w `' + folder + '/' + pluginName + '`');
              }

              // Add the plugin to the register
              memo[pluginName] = {
                folder: folder,
                path: path.join(folder, identity)
              };
            }

            return memo;
          }, {}));

          return cb();
        });
      }, cb);
    },

    /**
     * Load plugin and app controllers
     *
     * @param {Function} cb
     */
    loadControllers: function (cb) {
      // Load controllers from plugins
      async.reduce(Object.keys(sails.config.plugins.register), {}, function(memo, pluginName, cb) {
        var plugin = sails.config.plugins.register[pluginName];

        loadControllersFromPath(getPluginLookupPath(plugin.path, 'controllers'), function(err, controllers) {
          if(err) {return cb(err);}
          return cb(null, _.extend(memo, controllers));
        });
      }, function(err, pluginControllers) {
        //Load controllers from app
        if(err) {return cb(err);}

        loadControllersFromPath(sails.config.paths.controllers, function(err, controllers) {
          if(err) {return cb(err);}
          return bindToSails(cb)(null, sails.util.merge(pluginControllers, controllers));
        });
      });
    },




    /**
     * Load plugin and app model definitions
     *
     * @param {Function} cb
     */
    loadModels: function (cb) {
      async.reduce(Object.keys(sails.config.plugins.register), {}, function(memo, pluginName, cb) {
        var plugin = sails.config.plugins.register[pluginName];

        loadModelsFromPath(getPluginLookupPath(plugin.path, 'models'), function(err, models) {
          if (err) {return cb(err);}
          return cb(null, sails.util.merge(memo, models));
        });
      }, function(err, pluginModels) {
        if (err) {return cb(err);}

        loadModelsFromPath(sails.config.paths.models, function(err, models) {
          if(err) {return cb(err);}
          return bindToSails(cb)(null, sails.util.merge(pluginModels, models));
        });
      });
    },
  };

  function bindToSails(cb) {
    return function(err, modules) {
      if (err) {return cb(err);}
      _.each(modules, function(module) {
        // Add a reference to the Sails app that loaded the module
        module.sails = sails;
        // Bind all methods to the module context
        _.bindAll(module);
      });
      return cb(null, modules);
    };
  }

  function loadControllersFromPath(path, cb) {
    buildDictionary.optional({
      dirname: path,
      filter: /(.+)Controller\.(js|coffee|litcoffee)$/,
      flattenDirectories: true,
      keepDirectoryPath: true,
      replaceExpr: /Controller/
    }, cb);
  }

  function loadModelsFromPath(path, cb) {
    // Get the main model files
    buildDictionary.optional({
      dirname   : path,
      filter    : /^([^.]+)\.(js|coffee|litcoffee)$/,
      replaceExpr : /^.*\//,
      flattenDirectories: true
    }, function(err, models) {
      if (err) {return cb(err);}

      // Get any supplemental files
      buildDictionary.optional({
        dirname   : path,
        filter    : /(.+)\.attributes.json$/,
        replaceExpr : /^.*\//,
        flattenDirectories: true
      }, function(err, supplements) {
        if (err) {return cb(err);}
        return cb(null, sails.util.merge(models, supplements));
      });
    });
  }

  function getPluginLookupPath(pluginPath, type) {
    return path.resolve(sails.config.appPath, pluginPath, sails.config.plugins.paths[type]);
  }
};