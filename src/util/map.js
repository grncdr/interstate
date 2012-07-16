(function(red) {
var jsep = red.jsep, cjs = red.cjs, _ = cjs._;

var remove_by_index = function(arrayName,arrayIndex) { 
	arrayName.splice(arrayIndex,1); 
};

var RedMap = function() {
	this._keys = [];
	this._values = [];
};

(function(my) {
	var proto = my.prototype;
	proto.set = function() {
		var to_set;
		if(arguments.length >= 2) {
			var key = arguments[0], value = arguments[1];
			to_set = {};
			to_set[key] = value;
		} else {
			to_set = arguments[0];
		}

		_.forEach(to_set, _.bind(this.do_set, this));

		return this;
	};
	proto._key_index = function(key) {
		return _.indexOf(this._keys, key);
	};
	proto._do_set = function(key, value) {
		var key_index = this._key_index(key);

		if(key_index<0) {
			this._values[key_index] = value;
		} else {
			this._keys.push(key);
			this._values.push(value);
		}

		return this;
	};
	proto.get = function(key) {
		var key_index = this._key_index(key);
		if(key_index < 0) { return undefined; }
		else { return this.values[key_index]; }
	};
	proto.unset = function(key) {
		var key_index = this._key_index(key);
		if(key_index >= 0) {
			remove_by_index(this._keys, key_index);
			remove_by_index(this._values, key_index);
		}
		return this;
	};
	proto.forEach = function(func, context) {
		var len = this._keys.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = this._keys[i]; value = this._values[i];
			
			func.call(context, value, key, i);
		}
		return this;
	};
	proto.map = function(func, context) {
		var rv = new RedMap();
		this.forEach(function(value, key, index) {
			var mapped_val = func.apply(this, arguments);
			rv.set(key, mapped_val);
		}, context);
		return rv;
	};
	proto.to_obj = function() {
		var rv = {};
		this.forEach(function(value, key) {
			rv[key] = value;
		});
		return rv;
	};
	proto.any = function(func, context) {
		var len = this._keys.length;
		var key, value;
		context = context || this;
		for(var i = 0; i<len; i++) {
			key = this._keys[i]; value = this._values[i];
			
			var val = func.call(context, value, key, i);
			if(val) { return true; }
		}
		return false;
	};
}(RedMap));

red._create_map = function() { return new RedMap(); };

}(red));
