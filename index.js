
/*
Multi-tenancy for Mongoose

See readme for examples and info
@author Jason Raede <jason@torchedm.com>
 */
var _, collectionDelimiter, dot, owl;

//mongoose = require('mongoose');



dot = require('dot-component');

_ = require('underscore');

owl = require('owl-deepcopy');


/*
Added by @watnotte
 */

collectionDelimiter = '__';

module.exports = function(m, delimiter) {
  //mongoose = m;
  init(m);

  if (delimiter) {
    return collectionDelimiter = delimiter;
  }
};

var init = function(mongoose) {
  require('mongoose-schema-extend')(mongoose);

  mongoose.__proto__.Connection.prototype.__proto__.mtModel = mongoose.mtModel = function (name, schema, collectionName) {
    var extendPathWithTenantId, extendSchemaWithTenantId, i, len, model, modelName, multitenantSchemaPlugin, newSchema, origSchema, parts, pre, preModelName, precompile, split, tenantCollectionName, tenantId, tenantModelName, uniq;
    precompile = [];
    extendPathWithTenantId = function (tenantId, path) {
      var key, newPath, ref, val;
      if (path.instance !== 'ObjectID' && path.instance !== mongoose.Schema.Types.ObjectId) {
        return false;
      }
      if ((path.options.$tenant == null) || path.options.$tenant !== true) {
        return false;
      }
      newPath = {
        type: mongoose.Schema.Types.ObjectId
      };
      ref = path.options;
      for (key in ref) {
        val = ref[key];
        if (key !== 'type') {
          newPath[key] = _.clone(val, true);
        }
      }
      newPath.ref = tenantId + collectionDelimiter + path.options.ref;
      precompile.push(tenantId + '.' + path.options.ref);
      return newPath;
    };
    extendSchemaWithTenantId = function (tenantId, schema) {
      var config, extension, newPath, newSchema, newSubSchema, prop, ref;
      extension = {};
      newSchema = owl.deepCopy(schema);
      newSchema.callQueue.forEach(function (k) {
        var args, key, ref, val;
        args = [];
        ref = k[1];
        for (key in ref) {
          val = ref[key];
          args.push(val);
        }
        return k[1] = args;
      });
      ref = schema.paths;
      for (prop in ref) {
        config = ref[prop];
        if (config.options.type instanceof Array) {
          if (config.schema != null) {
            newSubSchema = extendSchemaWithTenantId(tenantId, config.schema);
            newSubSchema = extendSchemaWithTenantId(tenantId, config.schema);
            newSchema.path(prop, [newSubSchema]);
          } else {
            newPath = extendPathWithTenantId(tenantId, config.caster);
            if (newPath) {
              newSchema.path(prop, [newPath]);
            }
          }
        } else {
          if (config.schema != null) {
            newSubSchema = extendSchemaWithTenantId(tenantId, config.schema);
            newSchema.path(prop, newSubSchema);
          } else {
            newPath = extendPathWithTenantId(tenantId, config);
            if (newPath) {
              newSchema.path(prop, newPath);
            }
          }
        }
      }
      return newSchema;
    };
    multitenantSchemaPlugin = function (schema, options) {
      schema.statics.getTenantId = schema.methods.getTenantId = function () {
        return this.schema.$tenantId;
      };
      return schema.statics.getModel = schema.methods.getModel = function (name) {
        return mongoose.mtModel(this.getTenantId() + '.' + name);
      };
    };
    if (name.indexOf('.') >= 0) {
      parts = name.split('.');
      modelName = parts.pop();
      tenantId = parts.join('.');
      tenantModelName = tenantId + collectionDelimiter + modelName;
      if (mongoose.models[tenantModelName] != null) {
        return mongoose.models[tenantModelName];
      }
      model = this.model(modelName);
      tenantCollectionName = tenantId + collectionDelimiter + model.collection.name;
      origSchema = model.schema;
      newSchema = extendSchemaWithTenantId(tenantId, origSchema);
      newSchema.$tenantId = tenantId;
      newSchema.plugin(multitenantSchemaPlugin);
      if (mongoose.mtModel.goingToCompile.indexOf(tenantModelName) < 0) {
        mongoose.mtModel.goingToCompile.push(tenantModelName);
      }
      if (precompile.length) {
        uniq = _.uniq(precompile);
        for (i = 0, len = uniq.length; i < len; i++) {
          pre = uniq[i];
          split = pre.split('.');
          preModelName = split[0] + collectionDelimiter + split[1];
          if ((mongoose.models[preModelName] == null) && mongoose.mtModel.goingToCompile.indexOf(preModelName) < 0) {
            mongoose.mtModel(pre, null, tenantCollectionName);
          }
        }
      }
      return this.model(tenantModelName, newSchema, tenantCollectionName);
    } else {
      return this.model(name, schema, collectionName);
    }
  };

  mongoose.mtModel.goingToCompile = [];
};
