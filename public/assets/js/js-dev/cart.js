/**
 * Cart UI
 * TODO: update qty & price via backbone
 */

(function ( $ ) {
	"use strict";

	// pos_cart_params is required to continue, ensure the object exists
	if ( typeof pos_cart_params === 'undefined' ) {
		console.log('No pos_cart_params');
		return false;
	}

	/*======================================
	 Cart Items
	 =====================================*/

	// store wpnonce globally
	var wpnonce;

	// model holds the cart items
	var CartItem = Backbone.Model.extend({

		// default values for totals
		defaults: {
			'qty'			: 1,
			'title'			: '',
			'price'			: 0.00,
			'price_html'	: 0.00,
			'total'			: 0.00,
			'cart_item_key'	: '',
		},

		idAttribute: 'cart_item_key', // set cart_item_key as unique id

		// debug
		initialize: function() { this.on('all', function(e) { console.log(this.get('title') + " event: " + e); }); },

		// parse: function(response,options) {

		// 	//
		// 	console.log(response); //debug
		// 	this.setNonce(response.nonce);
		// 	return response.items;

		// },

		// setNonce: function(nonce) {
		// 	wpnonce = nonce;
		// },

	});

	// collection of cart items
	var CartItems = Backbone.Collection.extend({

		model: CartItem,
		url: pos_cart_params.ajax_url,

		// debug
		initialize: function() { this.on('all', function(e) { console.log("Item Collection event: " + e); }); },

		parse: function(response){

			// debug
			console.log(response);
			this.setNonce(response.nonce);
			return response.items;

		},

		setNonce: function(nonce) {
			wpnonce = nonce;
		},

	});

	// view holds individual cart items
	var CartItemView = Backbone.View.extend({
		
		tagName : 'tr',
		template: $('#tmpl-cart-item').html(),

		initialize: function() {

			// debug
			this.on('all', function(e) { console.log("Individual Item View event: " + e); });

			this.render();

			// If this models contents change, we re-render
			this.model.on('add remove change', function(){
				this.render();
			}, this);

		},

		events: {
			"click a.remove-from-cart"	: "removeFromCart",
			"click .qty input"  		: "edit",
			"keypress .qty input"  		: "updateOnEnter",
      		"blur .qty input"      		: "close"
		},

		removeFromCart: function(e) {
			if( typeof e !== 'undefined' ) e.preventDefault();

			// Fade out item out from the shopping cart list
			this.$el.fadeOut(500, function(){

				// Remove it from the DOM on completetion
				$(this).remove();

			});

			cartItems.fetch({
				data: {
					action		: "pos_remove_item",
					remove_item	: this.model.get('cart_item_key'),
					_wpnonce	: wpnonce,
				}, 
				processData: true,
				success: function() {
					// update the totals view
					mediator.publish('updateTotals');
				},
			});
		},

		edit: function() {
			this.$el.addClass('editing');
			this.$('.qty input').attr('contenteditable', true).focus();
		},


		close: function() {
			var value = this.$('.qty input').val();

			// return if qty hasn't changed
			if(value == this.model.get('qty')) {
				return;
			}

			// remove if qty is 0
			if (value == 0) {
				console.log('0 qty');
				this.removeFromCart();
				return;
			}

			// else, update value
			if (value) {
				cartItems.fetch({
					data: { 
						'action'		: 'pos_update_cart',
						'cart_item_key' : this.model.get('cart_item_key'),
						'qty'			: value,
					}, 
					processData: true,
					success: function() {
						// update the totals view
						mediator.publish("updateTotals");
					},
				});
				this.$el.removeClass('editing');
				this.$('.qty input').removeAttr('contenteditable');
			} else {
				this.$('.qty input').attr('contenteditable', true).focus();
			}
		},

		updateOnEnter: function(e) {

			// TODO: Blur and key event both happen, ie: double save :(
			if (e.keyCode == 13) this.close(); 
			_.delay( function() { self.$('.qty button').blur(), 100 });
		},

		render: function() {

			// Render this view and return its context
			this.$el.html( _.template( this.template, this.model.toJSON() ));
			return this;

		},

	});

	// view holds all the cart items
	var CartItemsView = Backbone.View.extend({
		el: $('#cart-items'),
		tagName: 'tbody',

		initialize: function() {

			// debug
			this.on('all', function(e) { console.log("Items View event: " + e); });

			// make a reference to the collection this view dances with
			this.collection = cartItems;

			// execute default message for the shopping cart on init
			this.defaultMessage();

			// this.render();

			// render cart items on add
			this.collection.on( 'add change', function( item ){

				// re-render
				this.render();

			}, this );

		},

		addToCart: function( id, variation_id ) {

			cartItems.fetch({
				data: {
					action			: "pos_add_to_cart",
					add_to_cart		: id,
					variation_id	: variation_id,
				}, 
				processData: true,
				success: function() {
					// update the totals view
					mediator.publish("updateTotals");
				},
			});
		},

		defaultMessage: function() {

			// Give the view a class of empty, and inject new default content
			// this.$el.html('<tr><td colspan="5">Cart is empty</td></tr>');
		},

		render: function() {

			// empty the CartTotalView view
			this.$el.html('');

			// loop through the collection
			this.collection.each( function ( item ) {

				// render each total model into this total view
				var newItem = new CartItemView({ model: item });
				this.$el.append( newItem.render().el );

			}, this); // pass this total view context
		},

	});

	// init the cart
	console.log('init cart items');

	// create a collection of CartTotals
	var cartItems = new CartItems();
	cartItems.fetch({
		data: { action: 'pos_get_cart_items' }, 
		processData: true,
	});

	// show the totals
	var cartItemsView = new CartItemsView();


	// subscribe to addToCart from the product list
	mediator.subscribe('addToCart', function( product ){ 

		var id 			 = product.get("id");
		var variation_id = '';

		if( product.get("type") === 'variation' ) {
			id 			 = product.get("parent_id");
			variation_id = product.get("id");
		}

		// add product to cart
		cartItemsView.addToCart( id, variation_id );

	});


	/*======================================
	 Cart Totals
	 =====================================*/

	// model holds cart totals
	var CartTotal = Backbone.Model.extend({

		// default values for totals
		defaults: {
			'title'		: 'Total',
			'total'		: '0.00',
		},

		// debug
		initialize: function() { this.on('all', function(e) { console.log(this.get('title') + " event: " + e); }); },

	});

	// collection of cart totals
	var CartTotals = Backbone.Collection.extend({

		model: CartTotal,
		url: pos_cart_params.ajax_url,

		// debug
		initialize: function() { this.on('all', function(e) { console.log("Total Collection event: " + e); }); },

		parse: function(response){

			// debug
			console.log(response);

			return response.totals;

		},
	});

	// view holds individual cart total
	var CartTotalView = Backbone.View.extend({
		
		tagName : 'tr',
		template: $('#tmpl-cart-total').html(),

		initialize: function() {

			// debug
			this.on('all', function(e) { console.log("Individual Total View event: " + e); });

			this.render();

			// If this models contents change, we re-render
			this.model.on('add', function(){
				this.render();
			}, this);

		},

		render: function() {

			// Render this view and return its context
			this.$el.html( _.template( this.template, this.model.toJSON() ));
			return this;

		},

	});

	// view holds all the cart totals
	var CartTotalsView = Backbone.View.extend({
		el: $('#cart-totals'),
		tagName: 'tfoot',

		initialize: function() {

			// debug
			this.on('all', function(e) { console.log("Totals View event: " + e); });

			// make a reference to the collection this view dances with
			this.collection = cartTotals;

			this.render();

			// render cart items on add
			this.collection.on( 'add change update', function( item ){

				this.render();

			}, this );

		},

		render: function() {

			// empty the CartTotalView view
			this.$el.html('');

			// loop through the collection
			this.collection.each( function ( item ) {

				if( item.get('total') != false || item.get('total') != '' ) {
					// render each total model into this total view
					var newTotal = new CartTotalView({ model: item });
					this.$el.append( newTotal.render().el );
				}

			}, this); // pass this total view context
		},

	});

	// init the cart totals
	console.log('init cart totals');

	// create a collection of CartTotals
	var cartTotals = new CartTotals();
	cartTotals.fetch({
		data: { action: 'pos_get_cart_totals' }, 
		processData: true,
	});

	// show the totals
	var cartTotalsView = new CartTotalsView();

	// listen for updateTotals events
	mediator.subscribe('updateTotals', function( ){ 

		cartTotals.fetch({
			data: { action: 'pos_get_cart_totals' }, 
			processData: true,
		});

	});


}(jQuery));