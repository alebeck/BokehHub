<template>
    <div>
        <div class="plot-container">
            <div id="plot"></div>
        </div>
    </div>
</template>

<script>
    export default {
        name: 'Plot',
    
        mounted() {
            const script = document.createElement('script');
            script.src = `${this.hostname}/script/${this.plot.id}?token=dontneedone&elemid=${this.elemId}`;
            script.id = this.elemId;
            script.async = false;
            document.getElementById('plot').appendChild(script);
        },
    
        props: {
            'plot': Object
        },
    
        computed: {
            elemId() {
                return Math.random().toString(36).substring(2, 15);
            },
            hostname() {
                return this.$store.getters.getSettings.hostname;
            }
        }
    }
</script>

<style scoped>
    .plot-container {
        margin: 0 auto;
    }
</style>