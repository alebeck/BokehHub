/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

import Vue from 'vue'
import App from './App'
import router from './router'
import store from './store'
import Element from 'element-ui'
import Icon from 'vue-awesome/components/Icon'
import { StatusIndicator } from 'vue-status-indicator'
import VueClip from 'vue-clip'
import VueProgressBar from 'vue-progressbar'
import axios from 'axios';

import 'element-ui/lib/theme-chalk/index.css';
import 'element-ui/lib/theme-chalk/display.css';
import 'vue-status-indicator/styles.css'

Vue.config.productionTip = false;

Vue.use(Element, {size: 'medium'});
Vue.use(VueClip);
Vue.use(VueProgressBar, {
    color: 'rgb(143, 255, 199)',
    failedColor: 'red',
    height: '2px'
});

Vue.component('icon', Icon);
Vue.component('status-indicator', StatusIndicator);

axios.defaults.baseURL = '/api/';

// get CSRF token
axios.get('/csrf').then(res => {
    axios.defaults.headers.common = {
        'X-CSRF-TOKEN': res.data.token
    };
});

/* eslint-disable no-new */
new Vue({
    el: '#app',
    router,
    store,
    components: { App },
    template: '<App/>'
});
