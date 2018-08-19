<template>

  <div id="navbar">
  <el-menu class="navbar" mode="horizontal">

    <div class="left-title">
      BokehHub
    </div>

    <div class="left-menu">
      <router-link tag="div" class="left-menu-item nav-link" to="/plots">Plots</router-link>
      <router-link tag="div" class="left-menu-item nav-link" to="/data">Data</router-link>
      <router-link v-if="isAdmin" tag="div" class="left-menu-item nav-link" to="/settings">Settings</router-link>
    </div>

    <div class="right-menu">
      <div class="right-menu-item">
        <el-popover placement="bottom" width="auto">
          <p style="text-align: center; margin-top: 0; margin-bottom: 8px">Logged in as {{username}}</p>
          <div style="text-align: center; margin: 0">
            <el-button type="primary" size="mini" @click="logout()">Logout</el-button>
          </div>
          <el-button slot="reference" type="text" style="color: inherit;">
            <icon name="user" scale="1.3" style="margin-bottom: -5px;"></icon> <span style="margin-left: 3px">{{username}}</span>
          </el-button>
        </el-popover>
      </div>
    </div>
  </el-menu>
</div>

</template>

<script>
import 'vue-awesome/icons/user'
import { mapMutations } from 'vuex'
import store from '@/store'
import axios from 'axios';

export default {
  name: 'Navbar',

  methods: {
    logout() {
      axios.get('/logout')
      .then(res => {
        console.log(res);
        if (res.data.success) {
          this.$store.commit('deauthenticate');
          this.$router.push('/login');
          return;
        }
        this.$message.error('Logout could not be performed');
      });
    }
  },

  computed: {
    icon() {
      return faUser
    },
    username() {
      return this.$store.getters.getUser.name
    },
    isAdmin() {
      return this.$store.getters.getUser.admin
    }
  }
}
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
.navbar {
  height: 50px;
  line-height: 50px;
  border-radius: 0px !important;
  border-bottom: 1px solid #e6e6e6;
  margin-top: 0;
  margin-bottom: 0;

  .nav-link {
    cursor: pointer;
  }

  .nav-link:active {
    color: #1b9ce5
  }

  .nav-link.router-link-active {
    border-bottom: 1px solid #1b9ce5;
    color: #1b9ce5; /*#31708e, #1b9ce5, 2e9cca*/
  }

  .left-title {
    float: left;
    font-weight: bold;
    font-size: larger;
    height: 100%;
    margin-left: 26px;
    &:focus{
     outline: none;
    }
  }

  .left-menu {
    float: left;
    height: 100%;
    margin-left: 26px;
    &:focus{
     outline: none;
    }
    .left-menu-item {
      display: inline-block;
      margin: 0 8px;
    }
  }

  .right-menu {
    float: right;
    height: 100%;
    margin-right: 20px;
    &:focus{
     outline: none;
    }
    .right-menu-item {
      display: inline-block;
      margin: 0 8px;

    .avatar-container {
      height: 50px;
      margin-right: 30px;
      .avatar-wrapper {
        cursor: pointer;
        margin-top: 5px;
        position: relative;
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
        }
        .el-icon-caret-bottom {
          position: absolute;
          right: -20px;
          top: 25px;
          font-size: 12px;
        }
      }
    }
  }
}}
.el-dropdown-link {
    cursor: pointer;
}
.el-dropdown-link:focus {
    outline: none;
}
</style>