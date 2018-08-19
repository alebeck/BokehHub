/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

import Vue from 'vue'
import Router from 'vue-router'
import store from '@/store'

import Layout from '@/components/Layout'
import Plots from '@/components/Plots'
import Data from '@/components/Data'
import Settings from '@/components/Settings'
import Login from '@/components/Login'

Vue.use(Router)

export default new Router({
  routes: [
    {
        path: '/login',
        name: 'Login',
        component: Login,
        beforeEnter: (to, from, next) => store.getters.isAuth ? next('/') : next()
    },
    {
    	path: '/',
    	name: 'Layout',
    	component: Layout,
    	redirect: '/plots',
    	children: [{
    		path: '/plots',
    		name: 'Plots',
    		component: Plots
    	},{
    		path: '/data',
    		name: 'Data',
    		component: Data
    	},{
    		path: '/settings',
    		name: 'Settings',
    		component: Settings,
            beforeEnter: (to, from, next) => store.getters.isAdmin ? next() : next('/')
    	}],
        beforeEnter: (to, from, next) => store.getters.isAuth ? next() : next('/login')
    },
    {
        path: '*', 
        redirect: '/' 
    }
  ]
})
