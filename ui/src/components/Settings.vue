<template>
    <div style="margin-top: 80px">
        <el-form :model="settings" label-width="180px" label-position="left" style="width: 60%; margin: 0 auto">
            <h4>General Settings</h4>
            <el-form-item label="Host name" :class="{'is-error': urlError}">
                <el-input v-model="settings.hostname"></el-input>
            </el-form-item>
            <el-form-item label="Default code for new plots">
                <el-input type="textarea" v-model="settings.defaultCode"></el-input>
            </el-form-item>
            <h4>Change Password</h4>
            <el-form-item label="Current Password" :class="{'is-error': oldError}">
                    <el-input type="password" v-model="settings.old"></el-input>
            </el-form-item>
            <el-form-item label="New Password" :class="{'is-error': newError}">
                    <el-input type="password" v-model="settings.new"></el-input>
            </el-form-item>
            <el-form-item label="Repeat" :class="{'is-error': newRepError}">
                    <el-input type="password" v-model="settings.new_rep"></el-input>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="saveSettings()">Save</el-button>
                <el-button @click="resetSettings()">Reset</el-button>
            </el-form-item>
         </el-form>
    </div>
</template>

<script>
    import axios from 'axios';
    import { deauthenticate } from '@/mixins'
    
    export default {
        name: 'Settings',
    
        mixins: [deauthenticate],
    
        data() {
            return {
                settings: {},
                oldError: false,
                newError: false,
                newRepError: false,
                urlError: false
            }
        },
    
        created() {
            this.loadSettings();
        },
    
        methods: {
            loadSettings() {
                axios.get('/settings').then(res => {
                    if (res.data.success) {
                        this.settings = res.data.settings;
                        this.$store.commit('setSettings', JSON.parse(JSON.stringify(this.settings)));
                        return;
                    }
                    console.error('Error loading settings');
                }).catch(err => {
                    console.error(err);
                    if (err.response.status && err.response.status == 401) {
                        this.deauthenticate();
                    }
                });
            },
    
            saveSettings() {
                this.oldError = false;
                this.newError = false;
                this.newRepError = false;
                this.urlError = false;
                
                if (this.settings.old || this.settings.new || this.settings.new_rep) {
                    if (!this.settings.old) {
                        this.oldError = true;
                    }
                    if (!this.settings.new) {
                        this.newError = true;
                    }
                    if (!this.settings.new_rep) {
                        this.newRepError = true;
                    }
                    if (this.settings.new_rep !== this.settings.new) {
                        this.newRepError = true;
                    }
                }
    
                if (!/^(https?):\/\/((([a-z\d\.-]{2,})\.([a-z]{2,}))|localhost|((\d{1,3}\.){3}\d{1,3}))(:\d{2,4})?$/.test(this.settings.hostname)) {
                    this.urlError = true;
                }
    
                if (this.oldError || this.newError || this.newRepError || this.urlError) {
                    return;
                }
    
                axios.put('/settings', {settings: this.settings}).then(res => {
                    if (res.data.success) {
                        this.$store.commit('setSettings', JSON.parse(JSON.stringify(this.settings)));
                        this.$message({
                                message: 'Settings successfully saved!',
                                type: 'success'
                        });
                        this.settings.old = "";
                        this.settings.new = "";
                        this.settings.new_rep = "";
                        return;
                    }
                    this.$message.error('Settings could not be saved');
                })
            },
    
            resetSettings() {
                this.settings = JSON.parse(JSON.stringify(this.$store.getters.getSettings));
            }
        }
    }
</script>