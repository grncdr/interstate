(function(red) {
var cjs = red.cjs, _ = red._;
var RedContext = function(options) {
	options = options || {};
	this._stack = options.stack || [];
	this._stack_pointer_index = _.size(this.get_stack())-1;
};
(function(my) {
	var proto = my.prototype;
	proto.get_stack = function() {
		return _.clone(this._stack);
	};
	proto.last = function() {
		return _.last(this._stack);
	};
	proto.push = function(item) {
		var stack = this.get_stack();
		stack.push(item); //It's a clone, so it doesn't affect my stack
		return red.create("context", {stack: stack});
	};
	proto.pop = function() {
		var stack = this.get_stack();
		stack.pop(); //It's a clone, so it doesn't affect my stack
		return red.create("context", {stack: stack});
	};
	proto.iter = function() {
		if(this._stack_pointer_index >= 0) {
			var stack = this.get_stack();
			var rv = stack[this._stack_pointer_index];
			this._stack_pointer_index--;
			return rv;
		} else {
			return undefined;
		}
	};
	proto.reset_iterator = function() {
		this._stack_pointer_index = _.size(this.get_stack())-1;
	};
	proto.eq = function(other_context) {
		var my_stack = this.get_stack();
		var other_stack = other_context.get_stack();
		if(my_stack.length !== other_stack.length) {
			return false;
		}
		for(var i = 0; i<my_stack.length; i++) {
			if(my_stack[i] !== other_stack[i]) {
				return false;
			}
		}
		return true;
	};
	proto.is_empty = function() {
		return _.isEmpty(this._stack);
	};

	proto.serialize = function() {
	};
	my.deserialize = function(obj) {
	};
}(RedContext));

red.RedContext = RedContext;
red.define("context", function(options) {
	var context = new RedContext(options);
	return context;
});

red.is_contextualizable = function(obj) {
	return obj instanceof red.RedCell || obj instanceof red.RedStatefulProp || obj instanceof red.RedGroup;
};

red.get_contextualizable = function(obj, context) {
	if(red.is_contextualizable(obj)) {
		return obj.get(context);
	}
	return cjs.get(obj);
};

red.check_context_equality = function(itema, itemb) {
	if(itema instanceof red.RedContext && itemb instanceof red.RedContext) {
		return itema.eq(itemb);
	} else {
		return itema === itemb;
	}
};

}(red));
