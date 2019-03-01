<template>
    <div>
        <el-table 
            :data="datasets"
            :empty-text="emptyText"
            :default-sort = "{prop: 'date', order: 'descending'}"
            style="width: 100%; margin-top: 60px">

            <el-table-column type="index" width="50"></el-table-column>
            <el-table-column prop="name" label="Name" width="auto" sortable>
                <template slot-scope="scope">
                    <status-indicator v-bind="getStatus(scope.row)"></status-indicator>
                    <span style="margin-left: 6px">{{ scope.row.name }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="date" label="Last changed" width="180" sortable>
                <template slot-scope="scope">
                    <i class="el-icon-time"></i>
                    <span style="margin-left: 10px">{{ scope.row.date }}</span>
                </template>
            </el-table-column>
            <el-table-column label="Operations" align="right">
            <template slot-scope="scope">
                <a :href="getDownloadLink(scope.row)" :style="{cursor: getCursor(scope.row.status)}" disabled><i class="el-icon-download icon"></i></a>
                <vue-clip :options="getUploadOptions(scope.row.name)" :on-complete="handleUpload" style="display: inline;">
                    <template slot="clip-uploader-action">
                            <i class="el-icon-upload2 icon" :style="{cursor: getCursor(scope.row.status)}"></i>
                    </template>
                </vue-clip>
                <a href="#" @click.prevent="handleDelete(scope.row)" :style="{cursor: getCursor(scope.row.status)}"><i class="el-icon-delete icon"></i></a>
            </template>
        </el-table-column>
        </el-table>

        <div class="centered" style="margin-top: 15px">
            <vue-clip :options="vcOptions" :on-complete="handleUpload" :on-total-progress="totalProgress" style="display: inline;">
                <template slot="clip-uploader-action">
                    <el-button>Add new</el-button>
                </template>
            </vue-clip>
        </div>

    </div>
</template>

<script>
    import axios from 'axios';
    import { deauthenticate, getStatus, getCursor } from '@/mixins'
    import 'vue-awesome/icons/trash'
    import 'vue-awesome/icons/arrow-down'
    
    export default {
        name: 'Data',
    
        mixins: [deauthenticate, getStatus, getCursor],
    
        data() {
            return {
                datasets: [],
                vcOptions: {
                    url: '/api/datasets',
                    headers: axios.defaults.headers.common
                },
                emptyText: 'Loading datasets...'
            }
        },
    
        created() {
            this.reloadDatasets();
            this.subscribe();
        },
    
        methods: {

            subscribe() {
                // subscribe to bokeh restart event
                this.$root.$off('restarted', this.reloadDatasets).$on('restarted', this.reloadDatasets)
            },
    
            reloadDatasets() {
                console.log('reloading datasets');
                axios.get('/datasets')
                .then(res => {
                    this.datasets = res.data;
                    this.emptyText = 'No datasets found.';
                }).catch(err => {
                    if (err.response.status && err.response.status == 401) {
                        this.deauthenticate();
                    }
                });
            },
    
            getDownloadLink(row) {
                if (row.status == 'pending') {
                    return '#';
                }
                return '/api/download/' + row.name;
            },
    
            getUploadOptions(name) {
                return {
                    url: '/api/datasets/' + name,
                    method: 'put',
                    headers: axios.defaults.headers.common
                }
            },
    
            handleUpload(file, status, xhr) {
                this.$Progress.finish();
                this.uploading = false;
                if (file.errorMessage) {
                    this.$message.error('File could not be uploaded: ' + file.errorMessage);
                    return;
                }
                var res = JSON.parse(xhr.response);
                if (res.success) {
                    this.reloadDatasets();
                    return;
                }
                if (res.errmsg) {
                    this.$message.error(res.errmsg);
                    return;
                }
                this.$message.error('An error occured while processing the uploaded file.');
            },
    
            totalProgress (progress) {
                this.$Progress.set(progress)
            },
    
            handleDelete(row) {
                if (row.status == 'pending') {
                    return;
                }
                this.$confirm('Do you really want to delete this dataset?', 'Delete Dataset', {
                    confirmButtonText: 'Delete',
                    cancelButtonText: 'Cancel',
                    type: 'warning',
                    confirmButtonClass: 'button-delete'
                })
                .then(res => {
                    if (res === 'confirm') {
                        axios.delete('/datasets/' + row.name)
                        .then(res => {
                            if (res.data.success) {
                                this.reloadDatasets();
                                return;
                            }
                            this.$message.error('File could not be deleted.');
                        });
                    }
                }).catch(_ => {});
            }
        }
    }
</script>

<style scoped>
    .icon {
        color: #606266;
        margin-left: 5px;
        font-size: 1.4em;
        line-height: 1.2em;
    }
    .el-icon-delete {
        color: #F56C6C;
    }
    .el-icon-upload2 {
        cursor: pointer;
    }
</style>
