<template>
	<el-form :model="loginForm" label-position="left" label-width="0px" @keyup.native.enter="submit()" class="login-container">
		<h3 class="login-title">BokehHub</h3>
		<el-form-item prop="user">
			<el-input type="text" v-model="loginForm.user" ref="user" auto-complete="off" placeholder="Username"></el-input>
		</el-form-item>
		<el-form-item prop="password" :class="{'is-error': isError}">
			<el-input type="password" v-model="loginForm.password" ref="password" auto-complete="off" placeholder="Password"></el-input>
		</el-form-item>
		<el-form-item style="width:100%;">
			<el-button type="primary" style="width:100%;" @click.native.prevent="submit()" :loading="loading">Login</el-button>
		</el-form-item>
	</el-form>
</template>

<script>
	import { mapMutations } from 'vuex'
	import store from '@/store'
	import axios from 'axios';
	
	export default {
		name: 'Login',
		methods: Object.assign({},
			mapMutations(['authenticate', 'setSettings']),
			{
				submit() {
					if (!this.loginForm.password) {
						this.isError = true;
						return;
					}
					this.loading = true;
					var data = {user: this.loginForm.user, password: this.loginForm.password};
					axios.post('/login', data)
					.then(res => {
						console.log(res);
						if (res.data.success) {
							this.isError = false;
							this.authenticate(res.data.user);
							this.setSettings(res.data.settings);
							this.$router.push('/');
							return;
						}
						this.loading = false;
						this.isError = true;
						this.$nextTick(() => this.$refs.password.focus())
					});
				}
			}),
	
		created() {
			var user = this.$store.getters.getLastUsername;
			if (user) {
				this.loginForm.user = user;
				this.$nextTick(() => this.$refs.password.focus())
			} 
			else {
				this.$nextTick(() => this.$refs.user.focus())
			}
		},
	
		data() {
			return {
				loading: false,
				remember: true,
				isError: false,
				loginForm: {}
			}
		}
	}
</script>

<style lang="scss" scoped>
	.login-container {
		/*box-shadow: 0 0px 8px 0 rgba(0, 0, 0, 0.06), 0 1px 0px 0 rgba(0, 0, 0, 0.02);*/
		-webkit-border-radius: 5px;
		border-radius: 5px;
		-moz-border-radius: 5px;
		background-clip: padding-box;
		margin: 180px auto;
		width: 350px;
		padding: 35px 35px 15px 35px;
		background: #fff;
		border: 1px solid #eaeaea;
		box-shadow: 0 0 25px #cac6c6;
		.login-title {
			margin: 0px auto 33px auto;
			text-align: center;
			color: #505458;
			font-weight: bold;
			font-size: xx-large;
		}
		.remember {
			margin: 0px 0px 35px 0px;
		}
	}
</style>
