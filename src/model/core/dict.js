(function(red) {
var cjs = red.cjs, _ = cjs._;

var RedDict = function(options) {
	options = options || {};

	//Properties
	this._direct_props = cjs.create("map");

	// Prototypes
	if(options.direct_protos) { this._direct_protos = options.direct_protos; }
	else { this._direct_protos = cjs.create("constraint", [], true); }
	
	// Attachments
	if(options.direct_attachments) { this._direct_attachments = options.direct_attachments; }
	else { this._direct_attachments = cjs.create("constraint", [], true); }
	this._direct_attachment_instances = cjs.create("map");

	this.type = "red_dict";
	this.id = _.uniqueId();
};

(function(my) {
	var proto = my.prototype;
	
	//
	// === DIRECT PROTOS ===
	//
	proto.direct_protos = function() {
		return this._direct_protos;
	};
	proto._get_direct_protos = function(context) {
		return red.get_contextualizable(this.direct_protos(), context.push(this));
	};
	//
	// === ALL PROTOS ===
	//
	proto.get_protos = proto._get_all_protos = function(context) {
		var direct_protos = this._get_direct_protos(context);
		var protos = _.map(direct_protos, function(direct_proto) {
			if(_.isUndefined(direct_proto)) { return false; };
			
			return ([direct_proto]).concat(direct_proto._get_all_protos(context));
		});
		protos = _.compact(_.flatten(protos, true));
		return protos;
	};
	
	//
	// === DIRECT PROPERTIES ===
	//
	proto.set = proto.set_prop = proto._set_direct_prop = function(name, value, index) {
		this._direct_props.set(name, value, index);
	};
	proto.unset = proto.unset_prop = proto._unset_direct_prop = function(name) {
		this._direct_props.unset(name);
	};
	proto._get_direct_prop = function(name) {
		return this._direct_props.get(name);
	};
	proto._has_direct_prop = function(name) {
		return this._direct_props.has_key(name);
	};
	proto.move = proto.move_prop = proto._move_direct_prop = function(name, to_index) {
		this._direct_props.move(name, to_index);
	};
	proto.index = proto.prop_index = proto._direct_prop_index = function(name) {
		return this._direct_props._key_index(name);
	};
	proto.rename = proto._rename_direct_prop = function(from_name, to_name) {
		if(this._has_direct_prop(to_name)) {
			throw new Error("Already a property with name " + to_name);
		} else {
			this._direct_props.rename(from_name, to_name);
		}
	};
	proto._get_direct_prop_names = function() {
		return this._direct_props.get_keys();
	};

	//
	// === FULLY INHERITED PROPERTIES ===
	//
	
	proto._get_inherited_prop = function(prop_name, context) {
		var protos = this._get_all_protos(context);
		for(var i = 0; i<protos.length; i++) {
			var protoi = protos[i];
			if(protoi._has_direct_prop(prop_name)) {
				return protoi._get_direct_prop(prop_name);
			}
		}
		return undefined;
	};
	proto._get_all_inherited_props = function(prop_name, context) {
		var rv = [];
		var protos = this._get_all_protos(context);
		for(var i = 0; i<protos.length; i++) {
			var protoi = protos[i];
			if(protoi._has_direct_prop(prop_name)) {
				rv.push(protoi._get_direct_prop(prop_name));
			}
		}
		return rv;
	};
	proto._has_inherited_prop = function(prop_name, context) {
		var protos = this._get_all_protos(context);
		for(var i = 0; i<protos.length; i++) {
			var protoi = protos[i];
			if(protoi._has_direct_prop(prop_name)) {
				return true;
			}
		}
		return false;
	};
	proto._get_inherited_prop_names = function(context) {
		var protos = this._get_all_protos(context);
		var rv = [];
		_.forEach(protos, function(protoi) {
			rv.push.apply(rv, protoi._get_direct_prop_names());
		});
		rv = _.unique(rv);
		return rv;
	};
	
	
	//
	// === PROPERTIES ===
	//
	proto.get_prop = function(prop_name, context) {
		if(this._has_direct_prop(prop_name)) {
			return this._get_direct_prop(prop_name);
		} else {
			return this._get_inherited_prop(prop_name, context);
		}
	};
	proto.has_prop = function(prop_name, context) {
		if(this._has_direct_prop(prop_name)) {
			return true;
		} else if(this._has_inherited_prop(prop_name, context)) {
			return true;
		} else {
			return false;
		}
	};
	proto.get = proto.prop_val = function(prop_name, context) {
		var val = this.get_prop(prop_name, context);
		if(context instanceof red.RedContext) {
			context = context.push(this);
		} else {
			context = cjs.create("red_context", {stack: [this]});
		}
		return red.get_contextualizable(val, context);
	};
	proto.get_prop_names = function(context) {
		var direct_prop_names = this._get_direct_prop_names();
		var inherited_prop_names = this._get_inherited_prop_names(context);
		return _.unique(direct_prop_names.concat(inherited_prop_names));
	};
	proto.is_inherited = function(prop_name, context) {
		var direct_prop_names = this._get_direct_prop_names();
		var inherited_prop_names = this._get_inherited_prop_names(context);
		return _.indexOf(direct_prop_names, prop_name) < 0 && _.indexOf(inherited_prop_names, prop_name) >= 0;
	};
	proto.inherit = function(prop_name) {
		if(!this.is_inherited(prop_name)) {
			throw new Error("Trying to inherit non-inherited property");
		}
		var prop_val = this.get(prop_name);
		var cloned_prop_val;
		if(prop_val instanceof red.RedCell) {
			cloned_prop_val = prop_val.clone();
		}
	};
	proto.name_for_prop = function(value) {
		return this._direct_props.key_for_value(value);
	};
	
	//
	// === DIRECT ATTACHMENTS ===
	//
	proto.direct_attachments = function() {
		return this._direct_attachments;
	};
	proto._get_direct_attachments = function(context) {
		return red.get_contextualizable(this.direct_attachments(), context.push(this));
	};
	
	//
	// === ALL ATTACHMENTS ===
	//
	proto.get_attachments = proto._get_all_attachments = function(context) {
		var protos = this.get_protos(context);

		var direct_attachments = this._get_direct_attachments(context);
		var proto_attachments = _.map(protos, function(protoi) {
			if(protoi instanceof red.RedDict) {
				return protoi._get_direct_attachments();
			} else {
				return [];
			}
		});

		var attachments = direct_attachments.concat(_.flatten(proto_attachments, true));
		return attachments;
	};
	
	//
	// === DIRECT ATTACHMENT INSTANCES ===
	//
	proto.add_direct_attachment_instance = function(attatchment, context) {
		var attachment_instances;
		if(this._direct_attachment_instances.has_key(attachment)) {
			attachment_instances = this._direct_attachment_instances.get(attachment);
		} else {
			attachment_instances = cjs.create("map");
			this._direct_attachment_instances.set(attachment, attachment_instances);
		}
		var attachment_instance = attachment.create_instance(context);
		attachment_instances.set(context, attachment_instance);
		return attachment_instance;
	};
	proto.has_direct_attachment_instance = function(attachment, context) {
		return !_.isUndefined(eet_direct_attachment_instance);
	};
	proto.get_direct_attachment_instance = function(attachment, context) {
		var attachment_instances;
		if(this._direct_attachment_instances.has_key(attachment)) {
			attachment_instances = this._direct_attachment_instances.get(attachment);
		} else {
			return undefined;
		}

		return attachment_instances.get(context);
	};
	proto.create_or_get_direct_attachment_instance = function(attachment, context) {
		var existing_instance = this.get_direct_attachment_instance;
		if(_.isUndefined(existing_instance)) {
			return this.add_direct_attachment_index(attachment, context);
		} else {
			return existing_instance;
		}
	};
	proto.create_or_get_direct_attachment_instances = function(context) {
		var attachments = this._get_direct_attachments(context);
		var self = this;
		var attachment_instances = _.map(attachment, function(attachment) {
			return self.create_or_get_direct_attachment_instance(attachment, context);
		});
		return attachment_instances;
	};
	
}(RedDict));

red.RedDict = RedDict;
cjs.define("red_dict", function(options) {
	var dict = new RedDict(options);
	return dict;
});
}(red));
