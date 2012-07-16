(function(red) {
var jsep = red.jsep, cjs = red.cjs, _ = cjs._;

(function(proto) {
	proto.on_create = function(target, type) {
		this.target = target;
		this.type = type;
	};
	proto.on_ready = function() {
		this.target.addEventListener(this.type, _.bind(this.notify, this));
	};
	proto.notify = function(event) {
		this.transition.run(event);
	};
}(red._create_event_type("dom_event").prototype));
}(red));
