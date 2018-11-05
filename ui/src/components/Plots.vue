<template>
	<div>
		<el-table :data="plots" :empty-text="emptyText" style="width: 100%; margin-top: 60px">

			<el-table-column type="index" width="50"></el-table-column>

			<el-table-column prop="id" label="ID" width="150">
				<template slot-scope="scope">
					<status-indicator v-bind="getStatus(scope.row)"></status-indicator>
					<span style="margin-left: 6px">{{ scope.row.id }}</span>
				</template>
			</el-table-column>

			<el-table-column prop="title" label="Title" width="auto"></el-table-column>

			<el-table-column prop="date" label="Last changed" width="180" sortable>
				<template slot-scope="scope">
					<i class="el-icon-time"></i>
					<span style="margin-left: 10px">{{ scope.row.date }}</span>
				</template>
			</el-table-column>

			<el-table-column label="Operations" align="right">
				<template slot-scope="scope">
					<a href="#" title="View Plot" @click.prevent="handleShow(scope.$index, scope.row)" :style="{cursor: getCursor(scope.row.status)}"><i class="el-icon-view icon"></i></a>
					<a href="#" title="Edit Plot" @click.prevent="handleEdit(scope.$index, scope.row)" :style="{cursor: getCursor(scope.row.status)}"><i class="el-icon-edit icon"></i></a>
					<a href="#" title="Show Tokens" @click.prevent="showTokens(scope.$index, scope.row)" :style="{cursor: getCursor(scope.row.status)}"><i class="el-icon-tickets icon"></i></a>
					<a href="#" title="Delete Plot" @click.prevent="handleDelete(scope.$index, scope.row)" :style="{cursor: getCursor(scope.row.status)}"><i class="el-icon-delete icon"></i></a>
				</template>
			</el-table-column>

		</el-table>

		<div class="centered" style="margin-top: 15px">
			<el-button @click="openCreateDialog()">Add new</el-button>
		</div>

		<el-dialog custom-class="showDialog" :title="dialogTitle ? dialogTitle : 'Untitled Plot'" :visible.sync="dialogVisible" width="1000px" top="5vh">
			<div class="plot-loader"></div>
			<plot :key="plotKey" :plot="dialogPlot"></plot>
		</el-dialog>

		<el-dialog custom-class="editDialog" title="Edit Plot" :visible.sync="editDialogVisible" width="80%" top="5vh">
			<codemirror v-model="code" :options="cmOptions"></codemirror>
			<span slot="footer" class="dialog-footer">
				<el-button @click="editDialogVisible = false">Cancel</el-button>
				<el-button type="primary" @click="saveCode()">Save</el-button>
			</span>
		</el-dialog>

		<el-dialog custom-class="editDialog" title="New Plot" :visible.sync="createDialogVisible" width="80%" top="5vh">
			<codemirror v-model="newPlot.code" :options="cmOptions"></codemirror>
			<span slot="footer" class="dialog-footer">
				<el-button @click="createDialogVisible = false">Cancel</el-button>
				<el-button type="primary" @click="createPlot()">Save</el-button>
			</span>
		</el-dialog>

		<el-dialog custom-class="tokenDialog" :title="'Tokens for plot '+tokenDialogId" :visible.sync="tokenDialogVisible" width="500px" top="5vh">
			You currently have the following tokens issued for this plot:
			<el-table :data="tokens" empty-text="No tokens created yet for this plot." style="width: 100%; margin-top: 15px">

				<el-table-column type="index" width="50"></el-table-column>
				<el-table-column prop="name" label="Name" width="auto"></el-table-column>
				<el-table-column label="Operations" align="right">
					<template slot-scope="scope">
						<a href="#" title="Embed plot using this token" @click.prevent="viewToken(scope.$index, scope.row)"><i class="el-icon-share icon"></i></a>
						<a href="#" title="Revoke Token" @click.prevent="revokeToken(scope.$index, scope.row)"><i class="el-icon-delete icon"></i></a>
					</template>
				</el-table-column>

			</el-table>
			<span slot="footer" class="dialog-footer">
				<el-button type="primary" @click="tokenNameInput = ''; createTokenDialogVisible = true">New Token</el-button>
				<el-button @click="tokenDialogVisible = false">Close</el-button>
			</span>
		</el-dialog>

		<el-dialog custom-class="createTokenDialog" title="New Token" :visible.sync="createTokenDialogVisible" width="500px" top="5vh">
			Please choose a name which is used to identify the new token. This could be e.g. the name of the website the token will be used on for embedding the plot. Note that it is recommended to create a new token for every website where you want to embed the plot.
			<el-input placeholder="Enter token name" v-model="tokenNameInput" style="margin-top: 15px"></el-input>
			<span slot="footer" class="dialog-footer">
				<el-button type="primary" :disabled="!tokenNameInput" @click="issueToken()">Create</el-button>
				<el-button @click="createTokenDialogVisible = false">Cancel</el-button>
			</span>
		</el-dialog>

		<el-dialog custom-class="embedDialog" title="Embed Plot" :visible.sync="embedDialogVisible" top="5vh">
			You can embed this plot via the following tag:
			<codemirror v-model="tagCode" :options="cmOptionsHTML" style="margin-top: 7px; margin-bottom: 7px"></codemirror>
			Note that you have to embed the following script on each page on which you want to use a plot element:
			<codemirror v-model="scriptCode" :options="cmOptionsHTML" style="margin-top: 7px; margin-bottom: 7px"></codemirror>
			The script is required only once per page.
			<span slot="footer" class="dialog-footer">
				<el-button @click="embedDialogVisible=false">Close</el-button>
			</span>
		</el-dialog>

	</div>
</template>

<script>
	import axios from 'axios';
	import Plot from './Plot';
	import { deauthenticate, getStatus, getCursor } from '@/mixins'
	import { codemirror } from 'vue-codemirror'
	
	import 'codemirror/lib/codemirror.css'
	import 'codemirror/mode/python/python.js'
	import 'codemirror/mode/xml/xml.js'
	import 'vue-awesome/icons/trash'
	
	export default {
	
		name: 'Plots',
	
		mixins: [deauthenticate, getStatus, getCursor],
		
		data() {
			return {
				plots: [],
				tokens: [],
				dialogTitle: '',
				dialogPlot: "",
				dialogVisible: false,
				editDialogVisible: false,
				createDialogVisible: false,
				embedDialogVisible: false,
				tokenDialogVisible: false,
				createTokenDialogVisible: false,
				tokenNameInput: "",
				tokenDialogId: "",
				plotKey: "1",
				code: '',
				tagCode: '',
				scriptCode: '',
				emptyText: 'You have no plots running at the moment.',
				plotId: null,
				cmOptions: {
					tabSize: 4,
					indentUnit: 4,
					mode: 'text/x-python',
					lineNumbers: true,
					line: true,
					viewportMargin: Infinity,
					extraKeys: {
						Tab: cm => {
							if (cm.somethingSelected()) {
								cm.indentSelection("add");
							} else {
								cm.replaceSelection(cm.getOption("indentWithTabs")? "\t": Array(cm.getOption("indentUnit") + 1).join(" "), "end", "+input");
							}
						}
					}
				},
				cmOptionsHTML: {
					tabSize: 4,
					mode: 'text/html',
					lineNumbers: true,
					line: true,
					viewportMargin: Infinity,
					readOnly: true
				},
				newPlot: {}
			}
		},
	
		created() {
			this.reloadPlots();
			this.subscribe();
		},
	
		methods: {
			handleShow(index, row) {
				if (row.status == 'pending') {
					return;
				}
				this.dialogTitle = row.title;
				this.dialogPlot = row;
				this.plotKey += "1"; //re-render plot
				this.dialogVisible = true;
			},
	
			handleEdit(index, row) {
				if (row.status == 'pending') {
					return;
				}
				this.code = row.code;
				this.plotId = row.id;
				this.editDialogVisible = true;
			},
	
			showTokens(index, row) {
				if (row.status == 'pending') {
					return;
				}
				axios.get('/tokens/' + row.id).then(res => {
					this.tokens = res.data.tokens;
					this.tokenDialogId = row.id;
					this.tokenDialogVisible = true;
				})
				.catch(err => console.error(err));
			},
	
			viewToken(index, row) { // row ^= token
				this.tagCode = `<plot id="${this.tokenDialogId}" width="970" height="400" key="${row.token}"></plot>`;
				this.scriptCode = '<script src="' + this.$store.getters.getSettings.hostname + '/js"></scrip' + 't>'
				this.embedDialogVisible = true;
			},
	
			issueToken() {
				axios.post('/tokens', {name: this.tokenNameInput, plotId: this.tokenDialogId}).then(res => {
					if (res.data.success) {
						this.tokens.push(res.data.token)
						this.createTokenDialogVisible = false;
					}
				})
				.catch(err => console.error(err));
			},
	
			revokeToken(index, row) {
				this.$confirm('Do you really want to revoke this token? It will no longer be possible for websites using this token to show the plot.', 'Revoke Token', {
					confirmButtonText: 'Revoke',
					cancelButtonText: 'Cancel',
					type: 'warning',
					confirmButtonClass: 'button-delete'
				})
				.then(res => {
					if (res === 'confirm') {
						axios.delete('/tokens', {data: {plotId: this.tokenDialogId, token: row.token}}).then(res => {
							if (res.data.success) {
								var that = this;
								setTimeout(function() {
									that.tokens = that.tokens.filter(t => t.token != row.token);
								}, 100);
								return;
							}
							this.$message.error('Token could not be revoked');
						}).catch(err => console.error(err));
					}
				})
				.catch(_ => {});
			},
	
			handleDelete(index, row) {
				if (row.status == 'pending') {
					return;
				}
				this.$confirm('Do you really want to delete this plot?', 'Delete Plot', {
					confirmButtonText: 'Delete',
					cancelButtonText: 'Cancel',
					type: 'warning',
					confirmButtonClass: 'button-delete'
				})
				.then(res => {
					if (res === 'confirm') {
						axios.delete('/plots/' + row.id)
						.then(res => {
							if (res.data.success) {
								this.reloadPlots();
								return;
							}
							this.$message.error('Plot could not be deleted.');
						});
					}
				})
				.catch(_ => {});
			},
	
			openCreateDialog() {
				this.newPlot.code = this.$store.getters.getSettings['defaultCode'];
				this.createDialogVisible = true;
			},
	
			subscribe() {
				// subscribe to bokeh restart event
				axios.get('/subscribe').then(res => {
					if (res.data.restarted) {
						this.reloadPlots();
					} else {
						console.error('Subscribe connection ended unexpectedly');
					}
					this.subscribe();
				})
				.catch(err => console.error(err));
			},
	
			reloadPlots() {
				axios.get('/plots').then(res => {
					this.plots = res.data;
				}).catch(err => {
					if (err.response.status && err.response.status == 401) {
						this.deauthenticate();
					}
				});
			},
	
			saveCode() {
				axios.put('/plots/' + this.plotId, {code: this.code})
				.then(res => {
					if (res.data.success) {
						this.editDialogVisible = false;
						this.reloadPlots();
						return;
					}
					this.$message.error('Plot could not be saved.');
				})
				.catch(err => console.error(err));;
			},
	
			createPlot() {
				axios.post('/plots', {code: this.newPlot.code}).then(res => {
					if (res.data.success) {
						this.createDialogVisible = false;
						this.reloadPlots();
						return;
					}
					this.$message.error('Plot could not be created.');
				})
				.catch(err => console.error(err));
			}
		},
	
		components: {
			Plot,
			codemirror
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
</style>
