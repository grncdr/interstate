(function(red) {
var cjs = red.cjs, _ = red._;

red.ContextualObject = function(options) {
	this.set_options(options);

	this.$value = new cjs.Constraint(_.bind(this._getter, this), false, { check_on_nullify: options.check_on_nullify === true });
	this._id = uid();
	red.register_uid(this._id, this);
	this._type = "none";
};

(function(my) {
	var proto = my.prototype;

	proto.id = proto.hash = function() { return this._id; };

	proto.get_pointer = function() { return this.pointer; }
	proto.set_options = function(options) {
		if(options) {
			if(_.has(options, "object")) {
				this.object = options.object;
			}
			if(_.has(options, "pointer")) {
				this.pointer = options.pointer;
			}
		}
	};

	proto.summarize = function() {
		var pointer = this.get_pointer();
		var object = this.get_object();
		var summarized_pointer = pointer.summarize();
		var summarized_object = object.id();
		return {
			id: this.id(),
			pointer: summarized_pointer,
			object_uid: summarized_object,
			type: this.type()
		};
	};

	proto.desummarize = function(obj) {
		var pointer = red.Pointer.desummarize(obj.pointer);
		var object = red.find_uid(obj.object_uid);
		return red.find_or_put_contextual_obj(object, pointer);
	};

	proto.toString = function() {
		return "p_" + this.get_pointer().toString();
	};
	proto.hash = function() {
		return this.get_pointer().hash();
	};

	proto.val = function() {
		return this.$value.get();
	};

	proto.destroy = function() {
		this.$value.destroy();
	};

	proto.get_name = function() {
		return this.name;
	};
	proto.is_inherited = function() {
		return this.inherited;
	};
	proto.get_object = function() {
		return this.object;
	};

	proto.activate = function() { };
	proto.deactivate = function() { };

	proto._getter = function() {
		return this.object;
	};
	proto.type = function() {
		return this._type;
	};
}(red.ContextualObject));


red.check_contextual_object_equality =  red.check_contextual_object_equality_eqeqeq = function(itema, itemb) {
	if(itema instanceof red.ContextualObject && itemb instanceof red.ContextualObject) {
		return itema.get_pointer().eq(itemb.get_pointer()) && itema.get_object() === itemb.get_object();
	} else {
		return itema === itemb;
	}
};
red.check_contextual_object_equality_eqeq = function(itema, itemb) {
	if(itema instanceof red.ContextualObject && itemb instanceof red.ContextualObject) {
		return itema.get_pointer().eq(itemb.get_pointer()) && itema.get_object() == itemb.get_object();
	} else {
		return itema == itemb;
	}
};

red.create_contextual_object = function(object, pointer, options) {
	options = _.extend({
		object: object,
		pointer: pointer,
	}, options);

	var rv;
	if(object instanceof red.Cell) {
		rv = new red.ContextualCell(options);
	} else if(object instanceof red.StatefulProp) {
		rv = new red.ContextualStatefulProp(options);
	} else if(object instanceof red.StatefulObj) {
		rv = new red.ContextualStatefulObj(options);
	} else if(object instanceof red.Dict) {
		rv = new red.ContextualDict(options);
	} else {
		rv = new red.ContextualObject(options);
	}

	return rv;
};

}(red));
