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