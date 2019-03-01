<template>
    <div id="app">
        <router-view/>
        <vue-progress-bar></vue-progress-bar>
    </div>
</template>

<script>
    export default {
        name: 'App'
    }
</script>

<style>
    body {
        margin: 0;
    }
    #app {
        font-family: 'Avenir', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        color: #2c3e50;
    }
    .el-message, .el-message-box, .el-popover {
        font-family: 'Avenir', Helvetica, Arial, sans-serif;
        outline: none;
    }
    .button-delete {
        background: #F56C6C !important;
        border-color: #F56C6C !important;
        color: #fff !important;
    }
    .button-delete:hover {
        background: #f78989 !important;
        border-color: #f78989 !important;
    }
    .button-delete:active {
        background: #dd6161 !important;
        border-color: #dd6161 !important;
        outline: 0 !important;
    }
    .fade-enter-active, .fade-leave-active {
        transition: opacity .1s;
    }
    .fade-enter, .fade-leave-to {
        opacity: 0;
    }
    a {
        text-decoration: none;
    }
    a:visited {
        color: inherit;
    }
    .el-card__header{
        padding: 10px 20px;
    }
    .el-card__body{
        padding: 0
    }
    .embedDialog .el-dialog__body {
        padding-top: 0;
        padding-bottom: 0;
    }
    .embedDialog .CodeMirror {
        height: unset;
    }
    .editDialog .el-dialog__body {
        padding: 0;
        height: 500px;
    }
    .editDialog .el-dialog__body .CodeMirror {
        height: 500px;
    }
    .showDialog .el-dialog__body {
        padding: 0;
        min-height: 118px;
    }
    .tokenDialog .el-dialog__body, .createTokenDialog .el-dialog__body {
        padding: 10px 20px;
    }
    .bk-plot-layout {
        margin: 0 auto;
    }
    @-webkit-keyframes load3 {
        0% {
            -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
        }
        100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
        }
    }
    @keyframes load3 {
        0% {
            -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
        }
        100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
        }
    }
    .plot-loader {
        font-size: 10px;
        position: absolute;
        margin-left: auto;
        margin-right: auto;
        left: 0;
        right: 0;
        top: 73px;
        text-indent: -9999em;
        width: 4.5em;
        height: 4.5em;
        border-radius: 50%;
        background: #409EFF;
        background: -moz-linear-gradient(left, #409EFF 10%, rgba(255, 255, 255, 0) 42%);
        background: -webkit-linear-gradient(left, #409EFF 10%, rgba(255, 255, 255, 0) 42%);
        background: -o-linear-gradient(left, #409EFF 10%, rgba(255, 255, 255, 0) 42%);
        background: -ms-linear-gradient(left, #409EFF 10%, rgba(255, 255, 255, 0) 42%);
        background: linear-gradient(to right, #409EFF 10%, rgba(255, 255, 255, 0) 42%);
        -webkit-animation: load3 1.4s infinite linear;
        animation: load3 1.4s infinite linear;
        -webkit-transform: translateZ(0);
        -ms-transform: translateZ(0);
        transform: translateZ(0);
    }
    .plot-loader:before {
        width: 50%;
        height: 50%;
        background: #409EFF;
        border-radius: 100% 0 0 0;
        position: absolute;
        top: 0;
        left: 0;
        content: '';
    }
    .plot-loader:after {
        background: white;
        width: 75%;
        height: 75%;
        border-radius: 50%;
        content: '';
        margin: auto;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
    }
    .status-indicator {
        cursor: default;
    }
    .centered {
        margin: 0 auto;
        text-align: center;
    }
</style>
