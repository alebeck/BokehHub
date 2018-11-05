/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

import Vue from 'vue'
import Vuex from 'vuex'
import VuexPersistence from 'vuex-persist'
import Cookies from 'js-cookie'

Vue.use(Vuex);

const state = {
	user: null, // currently logged in user
	lastUsername: "", // username which has logged in last
	settings: {}
};

const mutations = {
	authenticate(state, user) {
		state.user = user;
		state.lastUsername = user.name;
	},

	deauthenticate(state) {
		state.user = null;
	},

	setLastUsername(state, name) {
		state.lastUsername = name;
	},

	setSettings(state, settings) {
		state.settings = settings;
	}
};

const getters = {
	isAuth: state => state.user != null,
	isAdmin: state => state.user.admin,
	getUser: state => state.user,
	getLastUsername: state => state.lastUsername,
	getSettings: state => state.settings
};

const vuexCookie = new VuexPersistence({
	restoreState: (key, storage) => Cookies.getJSON(key),
	saveState: (key, state, storage) => Cookies.set(key, state, { expires: 3 }),
});

export default new Vuex.Store({
	state,
	mutations,
	getters,
	plugins: [vuexCookie.plugin]
});
