<template>
	<div class="app-wrapper">
		<navbar id="navbar"></navbar>
		<app-main id="app-main"></app-main>
	</div>
</template>

<script>
	import Navbar from './Navbar.vue'
	import AppMain from './AppMain.vue'
	
	export default {
		name: 'Layout',

		components: {
			Navbar,
			AppMain
		},

		data() {
			return {
				eventSource: null
			}
		},

		methods: {
			receiveMessage(message) {
				let parsed = JSON.parse(message.data);
				console.log('Received remote event: ' + parsed);
				this.$root.$emit(parsed);
			}
		},

		created() {
			// Setup event source
			this.eventSource = new EventSource('/api/events');
			this.eventSource.addEventListener('message', this.receiveMessage);
		},

		beforeDestroy() {
			this.$root.$off();
			this.eventSource.removeEventListener('message', this.receiveMessage);
		}
	}
</script>

<style scoped>
	#navbar {
		position: fixed;
		top: 0;
		width: 100%;
		z-index: 1000;
	}
	#app-main {
		margin-top: 50px;
	}
</style>