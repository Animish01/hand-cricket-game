
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const comp = writable(0);
    const target = writable(0);

    /* src\Toss.svelte generated by Svelte v3.44.0 */
    const file$5 = "src\\Toss.svelte";

    // (42:26) 
    function create_if_block_9(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "You have chosen Tails";
    			add_location(h2, file$5, 42, 8, 980);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(42:26) ",
    		ctx
    	});

    	return block;
    }

    // (40:4) {#if choice == 0}
    function create_if_block_8(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "You have chosen Heads";
    			add_location(h2, file$5, 40, 8, 912);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(40:4) {#if choice == 0}",
    		ctx
    	});

    	return block;
    }

    // (46:4) {#if choice == 0 || choice == 1}
    function create_if_block_7(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Toss Coin";
    			attr_dev(button, "class", "try svelte-99e2w1");
    			add_location(button, file$5, 46, 8, 1071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*tossCoin*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(46:4) {#if choice == 0 || choice == 1}",
    		ctx
    	});

    	return block;
    }

    // (55:23) 
    function create_if_block_6(ctx) {
    	let h2;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "You have lost the toss.";
    			t1 = space();
    			button = element("button");
    			button.textContent = "Reveal Computer's Choice";
    			add_location(h2, file$5, 55, 8, 1408);
    			attr_dev(button, "class", "svelte-99e2w1");
    			add_location(button, file$5, 56, 8, 1450);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*loseToss*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(55:23) ",
    		ctx
    	});

    	return block;
    }

    // (50:4) {#if win == 1}
    function create_if_block_5(ctx) {
    	let h20;
    	let t1;
    	let h21;
    	let t3;
    	let button0;
    	let t5;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h20 = element("h2");
    			h20.textContent = "You have won the toss!";
    			t1 = space();
    			h21 = element("h2");
    			h21.textContent = "What do you choose to do?";
    			t3 = space();
    			button0 = element("button");
    			button0.textContent = "I'm gonna bat!";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "I'm gonna bowl!";
    			add_location(h20, file$5, 50, 8, 1172);
    			add_location(h21, file$5, 51, 8, 1213);
    			attr_dev(button0, "class", "svelte-99e2w1");
    			add_location(button0, file$5, 52, 8, 1257);
    			attr_dev(button1, "class", "svelte-99e2w1");
    			add_location(button1, file$5, 53, 8, 1319);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h20, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h21, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*chooseBat*/ ctx[7], false, false, false),
    					listen_dev(button1, "click", /*chooseBowl*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h20);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h21);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(50:4) {#if win == 1}",
    		ctx
    	});

    	return block;
    }

    // (62:28) 
    function create_if_block_4$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "You have chosen to bowl.";
    			add_location(p, file$5, 62, 8, 1629);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(62:28) ",
    		ctx
    	});

    	return block;
    }

    // (60:4) {#if myChoice == 0}
    function create_if_block_3$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "You have chosen to bat.";
    			add_location(p, file$5, 60, 8, 1559);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(60:4) {#if myChoice == 0}",
    		ctx
    	});

    	return block;
    }

    // (68:34) 
    function create_if_block_2$3(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Computer has chosen to bowl.";
    			add_location(p, file$5, 68, 8, 1794);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(68:34) ",
    		ctx
    	});

    	return block;
    }

    // (66:4) {#if computerChoice == 0}
    function create_if_block_1$5(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Computer has chosen to bat.";
    			add_location(p, file$5, 66, 8, 1714);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(66:4) {#if computerChoice == 0}",
    		ctx
    	});

    	return block;
    }

    // (72:4) {#if myChoice == 0 || myChoice == 1 || computerChoice == 0 || computerChoice == 1}
    function create_if_block$5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Continue";
    			attr_dev(button, "class", "svelte-99e2w1");
    			add_location(button, file$5, 72, 8, 1944);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nexty*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(72:4) {#if myChoice == 0 || myChoice == 1 || computerChoice == 0 || computerChoice == 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let h2;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let t10;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*choice*/ ctx[0] == 0) return create_if_block_8;
    		if (/*choice*/ ctx[0] == 1) return create_if_block_9;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = (/*choice*/ ctx[0] == 0 || /*choice*/ ctx[0] == 1) && create_if_block_7(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*win*/ ctx[1] == 1) return create_if_block_5;
    		if (/*win*/ ctx[1] == 0) return create_if_block_6;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block2 = current_block_type_1 && current_block_type_1(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*myChoice*/ ctx[2] == 0) return create_if_block_3$1;
    		if (/*myChoice*/ ctx[2] == 1) return create_if_block_4$1;
    	}

    	let current_block_type_2 = select_block_type_2(ctx);
    	let if_block3 = current_block_type_2 && current_block_type_2(ctx);

    	function select_block_type_3(ctx, dirty) {
    		if (/*computerChoice*/ ctx[3] == 0) return create_if_block_1$5;
    		if (/*computerChoice*/ ctx[3] == 1) return create_if_block_2$3;
    	}

    	let current_block_type_3 = select_block_type_3(ctx);
    	let if_block4 = current_block_type_3 && current_block_type_3(ctx);
    	let if_block5 = (/*myChoice*/ ctx[2] == 0 || /*myChoice*/ ctx[2] == 1 || /*computerChoice*/ ctx[3] == 0 || /*computerChoice*/ ctx[3] == 1) && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h2 = element("h2");
    			h2.textContent = "Choose Heads or Tails";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "Heads";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Tails";
    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			if (if_block3) if_block3.c();
    			t9 = space();
    			if (if_block4) if_block4.c();
    			t10 = space();
    			if (if_block5) if_block5.c();
    			add_location(h2, file$5, 35, 4, 717);
    			attr_dev(button0, "class", "coin svelte-99e2w1");
    			add_location(button0, file$5, 36, 4, 753);
    			attr_dev(button1, "class", "coin svelte-99e2w1");
    			add_location(button1, file$5, 37, 4, 816);
    			add_location(main, file$5, 34, 0, 705);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h2);
    			append_dev(main, t1);
    			append_dev(main, button0);
    			append_dev(main, t3);
    			append_dev(main, button1);
    			append_dev(main, t5);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t6);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t7);
    			if (if_block2) if_block2.m(main, null);
    			append_dev(main, t8);
    			if (if_block3) if_block3.m(main, null);
    			append_dev(main, t9);
    			if (if_block4) if_block4.m(main, null);
    			append_dev(main, t10);
    			if (if_block5) if_block5.m(main, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*chooseHead*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*chooseTail*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(main, t6);
    				}
    			}

    			if (/*choice*/ ctx[0] == 0 || /*choice*/ ctx[0] == 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_7(ctx);
    					if_block1.c();
    					if_block1.m(main, t7);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if (if_block2) if_block2.d(1);
    				if_block2 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(main, t8);
    				}
    			}

    			if (current_block_type_2 !== (current_block_type_2 = select_block_type_2(ctx))) {
    				if (if_block3) if_block3.d(1);
    				if_block3 = current_block_type_2 && current_block_type_2(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(main, t9);
    				}
    			}

    			if (current_block_type_3 !== (current_block_type_3 = select_block_type_3(ctx))) {
    				if (if_block4) if_block4.d(1);
    				if_block4 = current_block_type_3 && current_block_type_3(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(main, t10);
    				}
    			}

    			if (/*myChoice*/ ctx[2] == 0 || /*myChoice*/ ctx[2] == 1 || /*computerChoice*/ ctx[3] == 0 || /*computerChoice*/ ctx[3] == 1) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);
    				} else {
    					if_block5 = create_if_block$5(ctx);
    					if_block5.c();
    					if_block5.m(main, null);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();

    			if (if_block2) {
    				if_block2.d();
    			}

    			if (if_block3) {
    				if_block3.d();
    			}

    			if (if_block4) {
    				if_block4.d();
    			}

    			if (if_block5) if_block5.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Toss', slots, []);
    	let toss, choice, win, myChoice, computerChoice;

    	const chooseHead = () => {
    		$$invalidate(0, choice = 0);
    	};

    	const chooseTail = () => {
    		$$invalidate(0, choice = 1);
    	};

    	const tossCoin = () => {
    		toss = Math.floor(Math.random() * 2);
    		$$invalidate(1, win = toss == choice);
    	};

    	const chooseBat = () => {
    		$$invalidate(2, myChoice = 0);
    	};

    	const chooseBowl = () => {
    		$$invalidate(2, myChoice = 1);
    	};

    	const loseToss = () => {
    		$$invalidate(3, computerChoice = Math.floor(Math.random() * 2));
    	};

    	const nexty = () => {
    		if (myChoice == 0 || computerChoice == 1) comp.set(1); else if (myChoice == 1 || computerChoice == 0) comp.set(2);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Toss> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		toss,
    		choice,
    		win,
    		myChoice,
    		computerChoice,
    		chooseHead,
    		chooseTail,
    		tossCoin,
    		chooseBat,
    		chooseBowl,
    		loseToss,
    		nexty
    	});

    	$$self.$inject_state = $$props => {
    		if ('toss' in $$props) toss = $$props.toss;
    		if ('choice' in $$props) $$invalidate(0, choice = $$props.choice);
    		if ('win' in $$props) $$invalidate(1, win = $$props.win);
    		if ('myChoice' in $$props) $$invalidate(2, myChoice = $$props.myChoice);
    		if ('computerChoice' in $$props) $$invalidate(3, computerChoice = $$props.computerChoice);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		choice,
    		win,
    		myChoice,
    		computerChoice,
    		chooseHead,
    		chooseTail,
    		tossCoin,
    		chooseBat,
    		chooseBowl,
    		loseToss,
    		nexty
    	];
    }

    class Toss extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toss",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\UserBattingFirst.svelte generated by Svelte v3.44.0 */
    const file$4 = "src\\UserBattingFirst.svelte";

    // (54:4) {#if lost_string == ""}
    function create_if_block_1$4(ctx) {
    	let p;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let button4;
    	let t11;
    	let button5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Click a button to show a number";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "One";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Two";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Three";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Four";
    			t9 = space();
    			button4 = element("button");
    			button4.textContent = "Five";
    			t11 = space();
    			button5 = element("button");
    			button5.textContent = "Six";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$4, 54, 8, 1517);
    			attr_dev(button0, "class", "deal svelte-i6fvij");
    			add_location(button0, file$4, 55, 8, 1584);
    			attr_dev(button1, "class", "deal svelte-i6fvij");
    			add_location(button1, file$4, 56, 8, 1644);
    			attr_dev(button2, "class", "deal svelte-i6fvij");
    			add_location(button2, file$4, 57, 8, 1704);
    			attr_dev(button3, "class", "deal svelte-i6fvij");
    			add_location(button3, file$4, 58, 8, 1766);
    			attr_dev(button4, "class", "deal svelte-i6fvij");
    			add_location(button4, file$4, 59, 8, 1827);
    			attr_dev(button5, "class", "deal svelte-i6fvij");
    			add_location(button5, file$4, 60, 8, 1888);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button4, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, button5, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*rand1*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*rand2*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", /*rand3*/ ctx[6], false, false, false),
    					listen_dev(button3, "click", /*rand4*/ ctx[7], false, false, false),
    					listen_dev(button4, "click", /*rand5*/ ctx[8], false, false, false),
    					listen_dev(button5, "click", /*rand6*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button4);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(button5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(54:4) {#if lost_string == \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (66:4) {#if lost_string != ""}
    function create_if_block$4(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*score*/ ctx[0] + 1 + "";
    	let t1;
    	let t2;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Target for computer is ");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "Continue";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$4, 66, 8, 2122);
    			attr_dev(button, "class", "svelte-i6fvij");
    			add_location(button, file$4, 67, 8, 2192);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nexty*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*score*/ 1 && t1_value !== (t1_value = /*score*/ ctx[0] + 1 + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(66:4) {#if lost_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let h20;
    	let t1;
    	let p0;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let p1;
    	let t6;
    	let t7;
    	let p2;
    	let t8;
    	let t9;
    	let t10;
    	let h21;
    	let t11;
    	let t12;
    	let if_block0 = /*lost_string*/ ctx[3] == "" && create_if_block_1$4(ctx);
    	let if_block1 = /*lost_string*/ ctx[3] != "" && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h20 = element("h2");
    			h20.textContent = "You are batting";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Your score: ");
    			t3 = text(/*score*/ ctx[0]);
    			t4 = space();
    			if (if_block0) if_block0.c();
    			t5 = space();
    			p1 = element("p");
    			t6 = text(/*put_string*/ ctx[2]);
    			t7 = space();
    			p2 = element("p");
    			t8 = text("Computer has shown: ");
    			t9 = text(/*comp_score*/ ctx[1]);
    			t10 = space();
    			h21 = element("h2");
    			t11 = text(/*lost_string*/ ctx[3]);
    			t12 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(h20, "class", "svelte-i6fvij");
    			add_location(h20, file$4, 51, 4, 1404);
    			attr_dev(p0, "class", "compscore svelte-i6fvij");
    			add_location(p0, file$4, 52, 4, 1434);
    			attr_dev(p1, "class", "compscore svelte-i6fvij");
    			add_location(p1, file$4, 62, 4, 1955);
    			attr_dev(p2, "class", "compscore svelte-i6fvij");
    			add_location(p2, file$4, 63, 4, 1998);
    			attr_dev(h21, "class", "svelte-i6fvij");
    			add_location(h21, file$4, 64, 4, 2061);
    			attr_dev(main, "class", "svelte-i6fvij");
    			add_location(main, file$4, 50, 0, 1392);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h20);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(main, t4);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t5);
    			append_dev(main, p1);
    			append_dev(p1, t6);
    			append_dev(main, t7);
    			append_dev(main, p2);
    			append_dev(p2, t8);
    			append_dev(p2, t9);
    			append_dev(main, t10);
    			append_dev(main, h21);
    			append_dev(h21, t11);
    			append_dev(main, t12);
    			if (if_block1) if_block1.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*score*/ 1) set_data_dev(t3, /*score*/ ctx[0]);

    			if (/*lost_string*/ ctx[3] == "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$4(ctx);
    					if_block0.c();
    					if_block0.m(main, t5);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*put_string*/ 4) set_data_dev(t6, /*put_string*/ ctx[2]);
    			if (dirty & /*comp_score*/ 2) set_data_dev(t9, /*comp_score*/ ctx[1]);
    			if (dirty & /*lost_string*/ 8) set_data_dev(t11, /*lost_string*/ ctx[3]);

    			if (/*lost_string*/ ctx[3] != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$4(ctx);
    					if_block1.c();
    					if_block1.m(main, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('UserBattingFirst', slots, []);
    	let score = 0;
    	let comp_score = 0;
    	let put_string = "";
    	let lost_string = "";

    	const rand1 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 1");
    		if (comp_score != 1) $$invalidate(0, score += 1); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const rand2 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 2");
    		if (comp_score != 2) $$invalidate(0, score += 2); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const rand3 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 3");
    		if (comp_score != 3) $$invalidate(0, score += 3); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const rand4 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 4");
    		if (comp_score != 4) $$invalidate(0, score += 4); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const rand5 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 5");
    		if (comp_score != 5) $$invalidate(0, score += 5); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const rand6 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 6");
    		if (comp_score != 6) $$invalidate(0, score += 6); else $$invalidate(3, lost_string = "You are out :(");
    	};

    	const nexty = () => {
    		target.set(score + 1);
    		comp.set(4);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<UserBattingFirst> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		target,
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	});

    	$$self.$inject_state = $$props => {
    		if ('score' in $$props) $$invalidate(0, score = $$props.score);
    		if ('comp_score' in $$props) $$invalidate(1, comp_score = $$props.comp_score);
    		if ('put_string' in $$props) $$invalidate(2, put_string = $$props.put_string);
    		if ('lost_string' in $$props) $$invalidate(3, lost_string = $$props.lost_string);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	];
    }

    class UserBattingFirst extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UserBattingFirst",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\ComputerBattingFirst.svelte generated by Svelte v3.44.0 */
    const file$3 = "src\\ComputerBattingFirst.svelte";

    // (54:4) {#if lost_string == ""}
    function create_if_block_1$3(ctx) {
    	let p;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let button4;
    	let t11;
    	let button5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Click a button to show a number";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "One";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Two";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Three";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Four";
    			t9 = space();
    			button4 = element("button");
    			button4.textContent = "Five";
    			t11 = space();
    			button5 = element("button");
    			button5.textContent = "Six";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$3, 54, 8, 1593);
    			attr_dev(button0, "class", "deal svelte-i6fvij");
    			add_location(button0, file$3, 55, 8, 1660);
    			attr_dev(button1, "class", "deal svelte-i6fvij");
    			add_location(button1, file$3, 56, 8, 1720);
    			attr_dev(button2, "class", "deal svelte-i6fvij");
    			add_location(button2, file$3, 57, 8, 1780);
    			attr_dev(button3, "class", "deal svelte-i6fvij");
    			add_location(button3, file$3, 58, 8, 1842);
    			attr_dev(button4, "class", "deal svelte-i6fvij");
    			add_location(button4, file$3, 59, 8, 1903);
    			attr_dev(button5, "class", "deal svelte-i6fvij");
    			add_location(button5, file$3, 60, 8, 1964);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button4, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, button5, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*rand1*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*rand2*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", /*rand3*/ ctx[6], false, false, false),
    					listen_dev(button3, "click", /*rand4*/ ctx[7], false, false, false),
    					listen_dev(button4, "click", /*rand5*/ ctx[8], false, false, false),
    					listen_dev(button5, "click", /*rand6*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button4);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(button5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(54:4) {#if lost_string == \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (66:4) {#if lost_string != ""}
    function create_if_block$3(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*score*/ ctx[0] + 1 + "";
    	let t1;
    	let t2;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Your target is ");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "Continue";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$3, 66, 8, 2198);
    			attr_dev(button, "class", "svelte-i6fvij");
    			add_location(button, file$3, 67, 8, 2260);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nexty*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*score*/ 1 && t1_value !== (t1_value = /*score*/ ctx[0] + 1 + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(66:4) {#if lost_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let h20;
    	let t1;
    	let p0;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let p1;
    	let t6;
    	let t7;
    	let p2;
    	let t8;
    	let t9;
    	let t10;
    	let h21;
    	let t11;
    	let t12;
    	let if_block0 = /*lost_string*/ ctx[3] == "" && create_if_block_1$3(ctx);
    	let if_block1 = /*lost_string*/ ctx[3] != "" && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h20 = element("h2");
    			h20.textContent = "Computer is batting";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Computer's score: ");
    			t3 = text(/*score*/ ctx[0]);
    			t4 = space();
    			if (if_block0) if_block0.c();
    			t5 = space();
    			p1 = element("p");
    			t6 = text(/*put_string*/ ctx[2]);
    			t7 = space();
    			p2 = element("p");
    			t8 = text("Computer has shown: ");
    			t9 = text(/*comp_score*/ ctx[1]);
    			t10 = space();
    			h21 = element("h2");
    			t11 = text(/*lost_string*/ ctx[3]);
    			t12 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(h20, "class", "svelte-i6fvij");
    			add_location(h20, file$3, 51, 4, 1470);
    			attr_dev(p0, "class", "compscore svelte-i6fvij");
    			add_location(p0, file$3, 52, 4, 1504);
    			attr_dev(p1, "class", "compscore svelte-i6fvij");
    			add_location(p1, file$3, 62, 4, 2031);
    			attr_dev(p2, "class", "compscore svelte-i6fvij");
    			add_location(p2, file$3, 63, 4, 2074);
    			attr_dev(h21, "class", "svelte-i6fvij");
    			add_location(h21, file$3, 64, 4, 2137);
    			attr_dev(main, "class", "svelte-i6fvij");
    			add_location(main, file$3, 50, 0, 1458);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h20);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(main, t4);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t5);
    			append_dev(main, p1);
    			append_dev(p1, t6);
    			append_dev(main, t7);
    			append_dev(main, p2);
    			append_dev(p2, t8);
    			append_dev(p2, t9);
    			append_dev(main, t10);
    			append_dev(main, h21);
    			append_dev(h21, t11);
    			append_dev(main, t12);
    			if (if_block1) if_block1.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*score*/ 1) set_data_dev(t3, /*score*/ ctx[0]);

    			if (/*lost_string*/ ctx[3] == "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$3(ctx);
    					if_block0.c();
    					if_block0.m(main, t5);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*put_string*/ 4) set_data_dev(t6, /*put_string*/ ctx[2]);
    			if (dirty & /*comp_score*/ 2) set_data_dev(t9, /*comp_score*/ ctx[1]);
    			if (dirty & /*lost_string*/ 8) set_data_dev(t11, /*lost_string*/ ctx[3]);

    			if (/*lost_string*/ ctx[3] != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					if_block1.m(main, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ComputerBattingFirst', slots, []);
    	let score = 0;
    	let comp_score = 0;
    	let put_string = "";
    	let lost_string = "";

    	const rand1 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 1");
    		if (comp_score != 1) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const rand2 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 2");
    		if (comp_score != 2) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const rand3 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 3");
    		if (comp_score != 3) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const rand4 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 4");
    		if (comp_score != 4) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const rand5 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 5");
    		if (comp_score != 5) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const rand6 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 6");
    		if (comp_score != 6) $$invalidate(0, score += comp_score); else $$invalidate(3, lost_string = "Computer is out!");
    	};

    	const nexty = () => {
    		target.set(score + 1);
    		comp.set(3);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ComputerBattingFirst> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		target,
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	});

    	$$self.$inject_state = $$props => {
    		if ('score' in $$props) $$invalidate(0, score = $$props.score);
    		if ('comp_score' in $$props) $$invalidate(1, comp_score = $$props.comp_score);
    		if ('put_string' in $$props) $$invalidate(2, put_string = $$props.put_string);
    		if ('lost_string' in $$props) $$invalidate(3, lost_string = $$props.lost_string);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	];
    }

    class ComputerBattingFirst extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ComputerBattingFirst",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\UserBattingSecond.svelte generated by Svelte v3.44.0 */
    const file$2 = "src\\UserBattingSecond.svelte";

    // (91:4) {#if lost_string == "" && win_string == ""}
    function create_if_block_2$2(ctx) {
    	let p;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let button4;
    	let t11;
    	let button5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Click a button to show a number";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "One";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Two";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Three";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Four";
    			t9 = space();
    			button4 = element("button");
    			button4.textContent = "Five";
    			t11 = space();
    			button5 = element("button");
    			button5.textContent = "Six";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$2, 91, 8, 2636);
    			attr_dev(button0, "class", "deal svelte-i6fvij");
    			add_location(button0, file$2, 92, 8, 2703);
    			attr_dev(button1, "class", "deal svelte-i6fvij");
    			add_location(button1, file$2, 93, 8, 2763);
    			attr_dev(button2, "class", "deal svelte-i6fvij");
    			add_location(button2, file$2, 94, 8, 2823);
    			attr_dev(button3, "class", "deal svelte-i6fvij");
    			add_location(button3, file$2, 95, 8, 2885);
    			attr_dev(button4, "class", "deal svelte-i6fvij");
    			add_location(button4, file$2, 96, 8, 2946);
    			attr_dev(button5, "class", "deal svelte-i6fvij");
    			add_location(button5, file$2, 97, 8, 3007);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button4, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, button5, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*rand1*/ ctx[6], false, false, false),
    					listen_dev(button1, "click", /*rand2*/ ctx[7], false, false, false),
    					listen_dev(button2, "click", /*rand3*/ ctx[8], false, false, false),
    					listen_dev(button3, "click", /*rand4*/ ctx[9], false, false, false),
    					listen_dev(button4, "click", /*rand5*/ ctx[10], false, false, false),
    					listen_dev(button5, "click", /*rand6*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button4);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(button5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(91:4) {#if lost_string == \\\"\\\" && win_string == \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (102:4) {#if lost_string != ""}
    function create_if_block_1$2(ctx) {
    	let h2;
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(/*lost_string*/ ctx[3]);
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$2, 102, 8, 3213);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*lost_string*/ 8) set_data_dev(t, /*lost_string*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(102:4) {#if lost_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (105:4) {#if win_string != ""}
    function create_if_block$2(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text(/*win_string*/ ctx[4]);
    			t1 = space();
    			button = element("button");
    			button.textContent = "Play Again";
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$2, 105, 8, 3284);
    			attr_dev(button, "class", "svelte-i6fvij");
    			add_location(button, file$2, 106, 8, 3315);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nexty*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*win_string*/ 16) set_data_dev(t0, /*win_string*/ ctx[4]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(105:4) {#if win_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let h2;
    	let t1;
    	let p0;
    	let t2;
    	let t3;
    	let t4;
    	let p1;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let p2;
    	let t9;
    	let t10;
    	let p3;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let if_block0 = /*lost_string*/ ctx[3] == "" && /*win_string*/ ctx[4] == "" && create_if_block_2$2(ctx);
    	let if_block1 = /*lost_string*/ ctx[3] != "" && create_if_block_1$2(ctx);
    	let if_block2 = /*win_string*/ ctx[4] != "" && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h2 = element("h2");
    			h2.textContent = "You are batting";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Target: ");
    			t3 = text(/*target1*/ ctx[5]);
    			t4 = space();
    			p1 = element("p");
    			t5 = text("Your score: ");
    			t6 = text(/*score*/ ctx[0]);
    			t7 = space();
    			if (if_block0) if_block0.c();
    			t8 = space();
    			p2 = element("p");
    			t9 = text(/*put_string*/ ctx[2]);
    			t10 = space();
    			p3 = element("p");
    			t11 = text("Computer has shown: ");
    			t12 = text(/*comp_score*/ ctx[1]);
    			t13 = space();
    			if (if_block1) if_block1.c();
    			t14 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$2, 87, 4, 2455);
    			attr_dev(p0, "class", "compscore svelte-i6fvij");
    			add_location(p0, file$2, 88, 4, 2485);
    			attr_dev(p1, "class", "compscore svelte-i6fvij");
    			add_location(p1, file$2, 89, 4, 2533);
    			attr_dev(p2, "class", "compscore svelte-i6fvij");
    			add_location(p2, file$2, 99, 4, 3074);
    			attr_dev(p3, "class", "compscore svelte-i6fvij");
    			add_location(p3, file$2, 100, 4, 3117);
    			attr_dev(main, "class", "svelte-i6fvij");
    			add_location(main, file$2, 86, 0, 2443);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h2);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(main, t4);
    			append_dev(main, p1);
    			append_dev(p1, t5);
    			append_dev(p1, t6);
    			append_dev(main, t7);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t8);
    			append_dev(main, p2);
    			append_dev(p2, t9);
    			append_dev(main, t10);
    			append_dev(main, p3);
    			append_dev(p3, t11);
    			append_dev(p3, t12);
    			append_dev(main, t13);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t14);
    			if (if_block2) if_block2.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*target1*/ 32) set_data_dev(t3, /*target1*/ ctx[5]);
    			if (dirty & /*score*/ 1) set_data_dev(t6, /*score*/ ctx[0]);

    			if (/*lost_string*/ ctx[3] == "" && /*win_string*/ ctx[4] == "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$2(ctx);
    					if_block0.c();
    					if_block0.m(main, t8);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*put_string*/ 4) set_data_dev(t9, /*put_string*/ ctx[2]);
    			if (dirty & /*comp_score*/ 2) set_data_dev(t12, /*comp_score*/ ctx[1]);

    			if (/*lost_string*/ ctx[3] != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$2(ctx);
    					if_block1.c();
    					if_block1.m(main, t14);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*win_string*/ ctx[4] != "") {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					if_block2.m(main, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('UserBattingSecond', slots, []);
    	let score = 0;
    	let comp_score = 0;
    	let put_string = "";
    	let lost_string = "";
    	let win_string = "";
    	let target1;

    	target.subscribe(value => {
    		$$invalidate(5, target1 = value);
    	});

    	const rand1 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 1");

    		if (comp_score != 1) $$invalidate(0, score += 1); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const rand2 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 2");

    		if (comp_score != 2) $$invalidate(0, score += 2); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const rand3 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 3");

    		if (comp_score != 3) $$invalidate(0, score += 3); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const rand4 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 4");

    		if (comp_score != 4) $$invalidate(0, score += 4); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const rand5 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 5");

    		if (comp_score != 5) $$invalidate(0, score += 5); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const rand6 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 6");

    		if (comp_score != 6) $$invalidate(0, score += 6); else {
    			$$invalidate(3, lost_string = "You are out :(");
    			$$invalidate(4, win_string = "You have lost the game :(");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have won the game! :D");
    	};

    	const nexty = () => {
    		target.set(0);
    		comp.set(0);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<UserBattingSecond> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		target,
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		win_string,
    		target1,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	});

    	$$self.$inject_state = $$props => {
    		if ('score' in $$props) $$invalidate(0, score = $$props.score);
    		if ('comp_score' in $$props) $$invalidate(1, comp_score = $$props.comp_score);
    		if ('put_string' in $$props) $$invalidate(2, put_string = $$props.put_string);
    		if ('lost_string' in $$props) $$invalidate(3, lost_string = $$props.lost_string);
    		if ('win_string' in $$props) $$invalidate(4, win_string = $$props.win_string);
    		if ('target1' in $$props) $$invalidate(5, target1 = $$props.target1);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		win_string,
    		target1,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	];
    }

    class UserBattingSecond extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UserBattingSecond",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\ComputerBattingSecond.svelte generated by Svelte v3.44.0 */
    const file$1 = "src\\ComputerBattingSecond.svelte";

    // (91:4) {#if lost_string == "" && win_string == ""}
    function create_if_block_2$1(ctx) {
    	let p;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let button4;
    	let t11;
    	let button5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Click a button to show a number";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "One";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Two";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Three";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Four";
    			t9 = space();
    			button4 = element("button");
    			button4.textContent = "Five";
    			t11 = space();
    			button5 = element("button");
    			button5.textContent = "Six";
    			attr_dev(p, "class", "compscore1 svelte-i6fvij");
    			add_location(p, file$1, 91, 8, 2754);
    			attr_dev(button0, "class", "deal svelte-i6fvij");
    			add_location(button0, file$1, 92, 8, 2821);
    			attr_dev(button1, "class", "deal svelte-i6fvij");
    			add_location(button1, file$1, 93, 8, 2881);
    			attr_dev(button2, "class", "deal svelte-i6fvij");
    			add_location(button2, file$1, 94, 8, 2941);
    			attr_dev(button3, "class", "deal svelte-i6fvij");
    			add_location(button3, file$1, 95, 8, 3003);
    			attr_dev(button4, "class", "deal svelte-i6fvij");
    			add_location(button4, file$1, 96, 8, 3064);
    			attr_dev(button5, "class", "deal svelte-i6fvij");
    			add_location(button5, file$1, 97, 8, 3125);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button4, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, button5, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*rand1*/ ctx[6], false, false, false),
    					listen_dev(button1, "click", /*rand2*/ ctx[7], false, false, false),
    					listen_dev(button2, "click", /*rand3*/ ctx[8], false, false, false),
    					listen_dev(button3, "click", /*rand4*/ ctx[9], false, false, false),
    					listen_dev(button4, "click", /*rand5*/ ctx[10], false, false, false),
    					listen_dev(button5, "click", /*rand6*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button4);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(button5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(91:4) {#if lost_string == \\\"\\\" && win_string == \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (102:4) {#if lost_string != ""}
    function create_if_block_1$1(ctx) {
    	let h2;
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(/*lost_string*/ ctx[3]);
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$1, 102, 8, 3331);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*lost_string*/ 8) set_data_dev(t, /*lost_string*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(102:4) {#if lost_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (105:4) {#if win_string != ""}
    function create_if_block$1(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text(/*win_string*/ ctx[4]);
    			t1 = space();
    			button = element("button");
    			button.textContent = "Play Again";
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$1, 105, 8, 3402);
    			attr_dev(button, "class", "svelte-i6fvij");
    			add_location(button, file$1, 106, 8, 3433);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nexty*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*win_string*/ 16) set_data_dev(t0, /*win_string*/ ctx[4]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(105:4) {#if win_string != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let h2;
    	let t1;
    	let p0;
    	let t2;
    	let t3;
    	let t4;
    	let p1;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let p2;
    	let t9;
    	let t10;
    	let p3;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let if_block0 = /*lost_string*/ ctx[3] == "" && /*win_string*/ ctx[4] == "" && create_if_block_2$1(ctx);
    	let if_block1 = /*lost_string*/ ctx[3] != "" && create_if_block_1$1(ctx);
    	let if_block2 = /*win_string*/ ctx[4] != "" && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h2 = element("h2");
    			h2.textContent = "Computer is batting";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Target: ");
    			t3 = text(/*target1*/ ctx[5]);
    			t4 = space();
    			p1 = element("p");
    			t5 = text("Computer's score: ");
    			t6 = text(/*score*/ ctx[0]);
    			t7 = space();
    			if (if_block0) if_block0.c();
    			t8 = space();
    			p2 = element("p");
    			t9 = text(/*put_string*/ ctx[2]);
    			t10 = space();
    			p3 = element("p");
    			t11 = text("Computer has shown: ");
    			t12 = text(/*comp_score*/ ctx[1]);
    			t13 = space();
    			if (if_block1) if_block1.c();
    			t14 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(h2, "class", "svelte-i6fvij");
    			add_location(h2, file$1, 87, 4, 2563);
    			attr_dev(p0, "class", "compscore svelte-i6fvij");
    			add_location(p0, file$1, 88, 4, 2597);
    			attr_dev(p1, "class", "compscore svelte-i6fvij");
    			add_location(p1, file$1, 89, 4, 2645);
    			attr_dev(p2, "class", "compscore svelte-i6fvij");
    			add_location(p2, file$1, 99, 4, 3192);
    			attr_dev(p3, "class", "compscore svelte-i6fvij");
    			add_location(p3, file$1, 100, 4, 3235);
    			attr_dev(main, "class", "svelte-i6fvij");
    			add_location(main, file$1, 86, 0, 2551);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h2);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(main, t4);
    			append_dev(main, p1);
    			append_dev(p1, t5);
    			append_dev(p1, t6);
    			append_dev(main, t7);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t8);
    			append_dev(main, p2);
    			append_dev(p2, t9);
    			append_dev(main, t10);
    			append_dev(main, p3);
    			append_dev(p3, t11);
    			append_dev(p3, t12);
    			append_dev(main, t13);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t14);
    			if (if_block2) if_block2.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*target1*/ 32) set_data_dev(t3, /*target1*/ ctx[5]);
    			if (dirty & /*score*/ 1) set_data_dev(t6, /*score*/ ctx[0]);

    			if (/*lost_string*/ ctx[3] == "" && /*win_string*/ ctx[4] == "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					if_block0.m(main, t8);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*put_string*/ 4) set_data_dev(t9, /*put_string*/ ctx[2]);
    			if (dirty & /*comp_score*/ 2) set_data_dev(t12, /*comp_score*/ ctx[1]);

    			if (/*lost_string*/ ctx[3] != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(main, t14);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*win_string*/ ctx[4] != "") {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(main, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ComputerBattingSecond', slots, []);
    	let score = 0;
    	let comp_score = 0;
    	let put_string = "";
    	let lost_string = "";
    	let win_string = "";
    	let target1;

    	target.subscribe(value => {
    		$$invalidate(5, target1 = value);
    	});

    	const rand1 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 1");

    		if (comp_score != 1) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const rand2 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 2");

    		if (comp_score != 2) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const rand3 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 3");

    		if (comp_score != 3) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const rand4 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 4");

    		if (comp_score != 4) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const rand5 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 5");

    		if (comp_score != 5) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const rand6 = () => {
    		$$invalidate(1, comp_score = Math.floor(Math.random() * 6) + 1);
    		$$invalidate(2, put_string = "You have shown: 6");

    		if (comp_score != 6) $$invalidate(0, score += comp_score); else {
    			$$invalidate(3, lost_string = "Computer is out!");
    			$$invalidate(4, win_string = "You have won the game! :D");
    		}

    		if (score >= target1) $$invalidate(4, win_string = "You have lost the game :(");
    	};

    	const nexty = () => {
    		target.set(0);
    		comp.set(0);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ComputerBattingSecond> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		target,
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		win_string,
    		target1,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	});

    	$$self.$inject_state = $$props => {
    		if ('score' in $$props) $$invalidate(0, score = $$props.score);
    		if ('comp_score' in $$props) $$invalidate(1, comp_score = $$props.comp_score);
    		if ('put_string' in $$props) $$invalidate(2, put_string = $$props.put_string);
    		if ('lost_string' in $$props) $$invalidate(3, lost_string = $$props.lost_string);
    		if ('win_string' in $$props) $$invalidate(4, win_string = $$props.win_string);
    		if ('target1' in $$props) $$invalidate(5, target1 = $$props.target1);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		score,
    		comp_score,
    		put_string,
    		lost_string,
    		win_string,
    		target1,
    		rand1,
    		rand2,
    		rand3,
    		rand4,
    		rand5,
    		rand6,
    		nexty
    	];
    }

    class ComputerBattingSecond extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ComputerBattingSecond",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.44.0 */
    const file = "src\\App.svelte";

    // (18:1) {#if toggle == 0}
    function create_if_block_4(ctx) {
    	let toss;
    	let current;
    	toss = new Toss({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(toss.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(toss, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toss.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toss.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(toss, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(18:1) {#if toggle == 0}",
    		ctx
    	});

    	return block;
    }

    // (21:1) {#if toggle == 1}
    function create_if_block_3(ctx) {
    	let userbattingfirst;
    	let current;
    	userbattingfirst = new UserBattingFirst({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(userbattingfirst.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(userbattingfirst, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(userbattingfirst.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(userbattingfirst.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(userbattingfirst, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(21:1) {#if toggle == 1}",
    		ctx
    	});

    	return block;
    }

    // (24:1) {#if toggle == 2}
    function create_if_block_2(ctx) {
    	let computerbattingfirst;
    	let current;
    	computerbattingfirst = new ComputerBattingFirst({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(computerbattingfirst.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(computerbattingfirst, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(computerbattingfirst.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(computerbattingfirst.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(computerbattingfirst, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(24:1) {#if toggle == 2}",
    		ctx
    	});

    	return block;
    }

    // (27:1) {#if toggle == 3}
    function create_if_block_1(ctx) {
    	let userbattingsecond;
    	let current;
    	userbattingsecond = new UserBattingSecond({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(userbattingsecond.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(userbattingsecond, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(userbattingsecond.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(userbattingsecond.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(userbattingsecond, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(27:1) {#if toggle == 3}",
    		ctx
    	});

    	return block;
    }

    // (30:1) {#if toggle == 4}
    function create_if_block(ctx) {
    	let computerbattingsecond;
    	let current;
    	computerbattingsecond = new ComputerBattingSecond({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(computerbattingsecond.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(computerbattingsecond, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(computerbattingsecond.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(computerbattingsecond.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(computerbattingsecond, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(30:1) {#if toggle == 4}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h2;
    	let t1;
    	let h1;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let current;
    	let if_block0 = /*toggle*/ ctx[0] == 0 && create_if_block_4(ctx);
    	let if_block1 = /*toggle*/ ctx[0] == 1 && create_if_block_3(ctx);
    	let if_block2 = /*toggle*/ ctx[0] == 2 && create_if_block_2(ctx);
    	let if_block3 = /*toggle*/ ctx[0] == 3 && create_if_block_1(ctx);
    	let if_block4 = /*toggle*/ ctx[0] == 4 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h2 = element("h2");
    			h2.textContent = "Welcome to";
    			t1 = space();
    			h1 = element("h1");
    			h1.textContent = "Hand Cricket!";
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			t6 = space();
    			if (if_block3) if_block3.c();
    			t7 = space();
    			if (if_block4) if_block4.c();
    			attr_dev(h2, "class", "svelte-1macs8q");
    			add_location(h2, file, 15, 1, 439);
    			attr_dev(h1, "class", "svelte-1macs8q");
    			add_location(h1, file, 16, 1, 461);
    			attr_dev(main, "class", "svelte-1macs8q");
    			add_location(main, file, 14, 0, 430);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h2);
    			append_dev(main, t1);
    			append_dev(main, h1);
    			append_dev(main, t3);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t4);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t5);
    			if (if_block2) if_block2.m(main, null);
    			append_dev(main, t6);
    			if (if_block3) if_block3.m(main, null);
    			append_dev(main, t7);
    			if (if_block4) if_block4.m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*toggle*/ ctx[0] == 0) {
    				if (if_block0) {
    					if (dirty & /*toggle*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t4);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*toggle*/ ctx[0] == 1) {
    				if (if_block1) {
    					if (dirty & /*toggle*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t5);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*toggle*/ ctx[0] == 2) {
    				if (if_block2) {
    					if (dirty & /*toggle*/ 1) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(main, t6);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*toggle*/ ctx[0] == 3) {
    				if (if_block3) {
    					if (dirty & /*toggle*/ 1) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(main, t7);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (/*toggle*/ ctx[0] == 4) {
    				if (if_block4) {
    					if (dirty & /*toggle*/ 1) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(main, null);
    				}
    			} else if (if_block4) {
    				group_outros();

    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let toggle = 0;

    	comp.subscribe(value => {
    		$$invalidate(0, toggle = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		comp,
    		Toss,
    		UserBattingFirst,
    		ComputerBattingFirst,
    		UserBattingSecond,
    		ComputerBattingSecond,
    		toggle
    	});

    	$$self.$inject_state = $$props => {
    		if ('toggle' in $$props) $$invalidate(0, toggle = $$props.toggle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [toggle];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
