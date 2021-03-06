/*jslint nomen: true, vars: true */
/*global interstate,able,uid,console,jQuery,window,Box2D */

(function (ist, $) {
	"use strict";

	if(!window.Box2D) { return; }

	var cjs = ist.cjs,
		_ = ist._;

	var PIXELS_PER_METER = 30;

	var B2Vec2 = Box2D.Common.Math.b2Vec2,
		B2AABB = Box2D.Collision.b2AABB,
		B2BodyDef = Box2D.Dynamics.b2BodyDef,
		b2Body = Box2D.Dynamics.b2Body,
		B2FixtureDef = Box2D.Dynamics.b2FixtureDef,
		B2Fixture = Box2D.Dynamics.b2Fixture,
		B2World = Box2D.Dynamics.b2World,
		B2MassData = Box2D.Collision.Shapes.b2MassData,
		B2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
		B2CircleShape = Box2D.Collision.Shapes.b2CircleShape,
		B2MouseJointDef =  Box2D.Dynamics.Joints.b2MouseJointDef,
		b2DebugDraw = Box2D.Dynamics.b2DebugDraw,
		b2ContactListener = Box2D.Dynamics.b2ContactListener;

	var fixDef = new B2FixtureDef();
	fixDef.density = 1.0;
	fixDef.friction = 0.5;
	fixDef.restitution = 0.2;

	var bodyDef = new B2BodyDef();
	bodyDef.type = b2Body.b2_dynamicBody;

	ist.contact_listeners = new RedMap({
		equals: ist.check_contextual_object_equality,
		hash: function(obj) {
			if(obj.hash) {
				return obj.hash();
			} else {
				return obj.toString();
			}
		}
	});
	
	ist.WorldAttachment = ist.register_attachment("box2d_world", {
			ready: function() {
				this.world = new B2World(new B2Vec2(0, 0), true);
				this.world.SetContactListener({
					BeginContact: function() { },
					EndContact: function(contact) {
						var cobj_a = contact.m_fixtureA.cobj,
							cobj_b = contact.m_fixtureB.cobj;

						var contact_listeners = _.filter(ist.contact_listeners.get(cobj_a), function(x) {
							return ist.check_contextual_object_equality(x.target, cobj_b);
						}).concat(_.filter(ist.contact_listeners.get(cobj_b), function(x) {
							return ist.check_contextual_object_equality(x.target, cobj_a);
						}));
						window.setTimeout(function() {
							_.each(contact_listeners, function(x) {
								x.callback(contact);
							});
						}, 0);
					},
					PreSolve: function() { },
					PostSolve: function() { }
				});

				var update_world = _.bind(function() {
					this.world.Step(1 / 60, 10, 10);
					ist.requestAnimationFrame.call(window, update_world);
					/*
					if(this.world.m_gravity.y < 5) {
						this.world.DrawDebugData();
					}
					*/
				}, this);
				ist.requestAnimationFrame.call(window, update_world);

/*
				var world = this.world;
				if(world.m_gravity.y < 5) {
					var debugDraw = new b2DebugDraw();
					debugDraw.SetSprite(document.getElementById("canvas").getContext("2d"));
					debugDraw.SetDrawScale(PIXELS_PER_METER);
					debugDraw.SetFillAlpha(0.3);
					debugDraw.SetLineThickness(1.0);
					debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
					world.SetDebugDraw(debugDraw);
				}
				*/
			},
			parameters: {
				gravity: function(contextual_object) {
					var gravity_x = contextual_object.prop_val("gx"),
						gravity_y = contextual_object.prop_val("gy");

					var gravity_vector = new B2Vec2(gravity_x, gravity_y);
					this.world.SetGravity(gravity_vector);
					var body_list = this.world.GetBodyList();
					var body_len = this.world.GetBodyCount();
					for(var i = 0; i<body_len; i++) {
						body_list.SetAwake(true);
						body_list = body_list.GetNext();
					}
				}
			},
			proto_props: {
				get_world: function() {
					return this.world;
				}
			}
		});
	ist.FixtureAttachment = ist.register_attachment("box2d_fixture", {
			ready: function() {
				var contextual_object = this.get_contextual_object();

				this.b2x = cjs.constraint(function() {
					var shape_type = contextual_object.prop_val("shape");
					if(shape_type === "circle") {
						return contextual_object.prop_val("cx");
					} else if(shape_type === "rectangle") {
						var x = contextual_object.prop_val("x"),
							width = contextual_object.prop_val("width");
						return x+width/2;
					} else {
						return -1;
					}
				});
				this.b2y = cjs.constraint(function() {
					var shape_type = contextual_object.prop_val("shape");
					if(shape_type === "circle") {
						return contextual_object.prop_val("cy");
					} else if(shape_type === "rectangle") {
						var y = contextual_object.prop_val("y"),
							height = contextual_object.prop_val("height");
						return y+height/2;
					} else {
						return -1;
					}
				});
				this.b2vx = cjs.constraint(0);
				this.b2vy= cjs.constraint(0);
				this.b2t = cjs.constraint(0);
				this.b2vt = cjs.constraint(0);
				this.body = cjs.constraint();
				this.shape = cjs.constraint();
				this.fixture = cjs.constraint();

				this._update_interval = window.setInterval(_.bind(function() {
					var body = this.get_body();
					if(body) {
						var position = body.GetPosition();
						var angle = body.GetAngle();
						var linearVelocity = body.GetLinearVelocity();
						var angularVelocity = body.GetAngularVelocity();

						cjs.wait();
						var shape = this.shape.get();
						if(shape instanceof B2CircleShape) {
							this.b2x.set(position.x * PIXELS_PER_METER);
							this.b2y.set(position.y * PIXELS_PER_METER);
						} else if(shape instanceof B2PolygonShape) {
							var v0 = shape.m_vertices[0],
								v1 = shape.m_vertices[2],
								width = Math.abs(v0.x-v1.x),
								height = Math.abs(v0.y-v1.y);
							this.b2x.set((position.x-width/2) * PIXELS_PER_METER);
							this.b2y.set((position.y-height/2) * PIXELS_PER_METER);
						}

						this.b2vx.set(linearVelocity.x);
						this.b2vy.set(linearVelocity.y);

						this.b2t.set(angle);

						this.b2vt.set(angularVelocity);

						cjs.signal();
					}
					/**/
				}, this), 1000 / 60);
			},
			destroy: function(silent) {
				window.clearInterval(this._update_interval);

				var body = this.get_body();
				if(body) {
					var world = body.m_world;
					world.DestroyBody(body);
				}
			},
			parameters: {
				radius: function(contextual_object) {
					var shape = this.shape.get();
					if(shape instanceof B2CircleShape) {
						var radius = contextual_object.prop_val("r");
						shape.SetRadius(radius/PIXELS_PER_METER);
					}
				}, 
				fixture_attributes: function(contextual_object) {
					var fixture = this.get_fixture();
					if(fixture) {
						var density = contextual_object.prop_val("density"),
							friction = contextual_object.prop_val("friction"),
							restitution = contextual_object.prop_val("restitution");

						fixture.density = density;
						fixture.friction = friction;
						fixture.restition = restitution;
					}
				},
				path: function(contextual_object) {
					var shape = this.shape.get();
					if(shape instanceof B2PolygonShape) {
						var width = contextual_object.prop_val("width"),
							height = contextual_object.prop_val("height");
						shape.SetAsBox(width/(2*PIXELS_PER_METER),
										height/(2*PIXELS_PER_METER));
					}
				},
				fixed: function(contextual_object) {
					var fixed = contextual_object.prop_val("fixed");
					var body = this.body.get();

					if(body) {
						if(fixed) {
							var shape = this.shape.get(), x, y;
							if(shape instanceof B2CircleShape) {
								var radius = contextual_object.prop_val("r");
								x = (contextual_object.prop_val("cx")) / PIXELS_PER_METER;
								y = (contextual_object.prop_val("cy")) / PIXELS_PER_METER;
							} else if(shape instanceof B2PolygonShape) {
								var half_width = contextual_object.prop_val("width")/2;
								var half_height = contextual_object.prop_val("height")/2;
								x = (contextual_object.prop_val("x")+half_width) / PIXELS_PER_METER;
								y = (contextual_object.prop_val("y")+half_height) / PIXELS_PER_METER;
							}
							body.SetType(b2Body.b2_staticBody);
							body.SetPosition(new B2Vec2(x, y));
						} else {
							body.SetType(b2Body.b2_dynamicBody);
							body.SetAwake(true);
						}
					}
				}, world: function(contextual_object) {
					var world_val = contextual_object.prop_val("world");

					if(world_val) {
						var world_attachment = world_val.get_attachment_instance("box2d_world");
						var world = world_attachment.get_world();
						if(this.world !== world) {
							var shape_type = contextual_object.prop_val("shape");
							if(shape_type === "circle" || shape_type === "rectangle") {
								var density = contextual_object.prop_val("density"),
									friction = contextual_object.prop_val("friction"),
									restitution = contextual_object.prop_val("restitution"),
									fixed = contextual_object.prop_val("fixed"),
									fixture;

								fixDef.density = density;
								fixDef.friction = friction;
								fixDef.restitution = restitution;

								bodyDef.type = fixed ? b2Body.b2_staticBody : b2Body.b2_dynamicBody;

								if(shape_type === "circle") {
									var cx = contextual_object.prop_val("cx"),
										cy = contextual_object.prop_val("cy"),
										radius = contextual_object.prop_val("r");

									bodyDef.position.x = (cx) / PIXELS_PER_METER;
									bodyDef.position.y = (cy) / PIXELS_PER_METER;
									fixDef.shape = new B2CircleShape(radius/PIXELS_PER_METER);
								} else if(shape_type === "rectangle") {
									var x = contextual_object.prop_val("x"),
										y = contextual_object.prop_val("y"),
										half_width = contextual_object.prop_val("width")/2,
										half_height = contextual_object.prop_val("height")/2;

									bodyDef.position.x = (x+half_width) / PIXELS_PER_METER;
									bodyDef.position.y = (y+half_height) / PIXELS_PER_METER;
									fixDef.shape = new B2PolygonShape();
									fixDef.shape.SetAsBox(half_width/PIXELS_PER_METER,
															half_height/PIXELS_PER_METER);

								}
								fixture = world.CreateBody(bodyDef).CreateFixture(fixDef);
								fixture.cobj = contextual_object;

								this.fixture.set(fixture);

								var body = fixture.GetBody();

								this.body.set(body);
								this.shape.set(fixture.GetShape());

								var position = body.GetPosition();
								var angle = body.GetAngle();
								var linearVelocity = body.GetLinearVelocity();
								var angularVelocity = body.GetAngularVelocity();

								this.b2x.set(position.x * PIXELS_PER_METER);
								this.b2y.set(position.y * PIXELS_PER_METER);

								this.b2vx.set(linearVelocity.x);
								this.b2vy.set(linearVelocity.y);

								this.b2t.set(angle);

								this.b2vt.set(angularVelocity);

								this.world = world;
							}
						}
					}
				}
			},
			proto_props: {
				get_fixture: function() {
					return this.fixture.get();
				},
				get_body: function() {
					return this.body.get();
				},
				get_shape: function() {
					return this.shape.get();
				},
				getComputedX: function() {
					return this.b2x.get();
				},
				getComputedY: function() {
					return this.b2y.get();
				},
				getComputedTheta: function() {
					return this.b2t.get();
				},
				applyForce: function(x, y) {
					var body = this.get_body();
					if(body) {
						setTimeout(function() {
							body.ApplyForce(new B2Vec2(x, y), body.GetWorldCenter());
						});
					}
				},
				applyImpulse: function(x, y) {
					var body = this.get_body();
					if(body) {
						setTimeout(function() {
							body.ApplyImpulse(new B2Vec2(x, y), body.GetWorldCenter());
						});
					}
				}
			}
		});
}(interstate, jQuery));
