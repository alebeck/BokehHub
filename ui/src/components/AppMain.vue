<template>
	<section class="app-main" style="min-height: 100%">
		<transition name="fade" mode="out-in">
			<keep-alive include="Plots">
				<router-view></router-view>
			</keep-alive>
		</transition>
	</section>
</template>

<script>
	export default {
		name: 'AppMain',
	}
</script>

<style scoped>
	.app-main {
		margin: 16px;
	}
</style>