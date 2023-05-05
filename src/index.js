const process = require("process")

class CoCreateMetrics {
	constructor(crud) {
		this.wsManager = crud.wsManager,
		this.crud = crud;
		this.metrics = new Map();
		this.cycleTime = 60;
		this.staticMemorySize = "10";
		this.init();
	}

	init() {
		if (this.wsManager) {
			this.wsManager.on('setBandwidth', (socket, data) => this.setBandwidth(data));
			this.wsManager.on('createMetrics', (socket, data) => this.create(data));
			this.wsManager.on('deleteMetrics', (socket, data) => this.remove(data));
			this.wsManager.on('changeCountMetrics', (socket, data) => this.changeCount(data))
		}

		process.on('deleteOrg', async (organization_id) => {
			this.metrics.delete(organization_id)
		})

		let self = this;
		this.timer = setInterval(() => {
			self.store();
		}, self.cycleTime * 1000);
	}

	__refresh() {
		let date = new Date();
		let strDate = date.toISOString();

		this.metrics.forEach((item) => {
			item.time = strDate;
			item.in_size = [];
			item.out_size = [];
			item.memorySize = [];
		})
	}

	setBandwidth({ type, data, organization_id }) {
		try {
			let date = new Date();
			let size = 0;

			type = type || 'in'

			if (data instanceof Buffer) {
				size = data.byteLength;
			} else if (data instanceof String || typeof data === 'string') {
				size = Buffer.byteLength(data, 'utf8');
			}

			if (size > 0 && organization_id) {
				let item = this.metrics.get(organization_id);
				if (!item) return

				item.time = date.toISOString();

				if (type == "in") {
					item.in_size.push(size);
				} else {
					item.out_size.push(size);
				}
			}

		} catch (err) {
			console.log(err)
		}
	}

	setMemory({ data, organization_id }) {
		if (data > 0 && organization_id) {
			let item = this.metrics.get(organization_id)
			if (!item) return

			item.memory = data;
			item.memory_cnt = 0;
		}
	}

	create({ organization_id, client_cnt, total_cnt }) {
		if (!organization_id || organization_id == 'users') return;

		let metric = this.metrics.get(organization_id);

		if (!metric) {
			this.metrics.set(organization_id, {
				in_size: [],
				out_size: [],
				memorySize: [],
				total_cnt: total_cnt,
				client_cnt: client_cnt
			})
		} else {
			metric.client_cnt = client_cnt;
		}
	}

	remove({ organization_id }) {
		this.metrics.delete(organization_id)
	}

	changeCount({ organization_id, total_cnt, client_cnt }) {
		if (!organization_id || organization_id == 'users') return;
		let metric = this.metrics.get(organization_id)
		if (metric) {
			metric['total_cnt'] = total_cnt;
			metric['client_cnt'] = client_cnt;
		} else {
			this.create({ organization_id, client_cnt, total_cnt })
		}
	}

	async store() {
		let date = new Date();
		let self = this;

		let total_cnt = 0;
		this.metrics.forEach((item) => { total_cnt += item.client_cnt })

		const used = process.memoryUsage();
		let totalMemory = used.heapUsed;

		this.metrics.forEach(async (item, organization_id) => {
			if (organization_id) {
				let inSize = 0, outSize = 0, memorySize = 0
				inSize = item.in_size.reduce((a, b) => a + b, 0);
				outSize = item.out_size.reduce((a, b) => a + b, 0);

				let maxIn = 0, maxOut = 0

				if (inSize > 0) {
					inSize = inSize / item.in_size.length;
					maxIn = Math.max(...item.in_size);
				}

				if (outSize > 0) {
					outSize = inSize / item.out_size.length;
					maxOut = Math.max(...item.out_size);
				}

				//. calcuate memory size
				// memorySize = (item.client_cnt / total_cnt) * totalMemory + inSize + outSize;
				memorySize = maxIn > maxOut ? maxIn : maxOut;

				let dbSize = await self.crud.databaseStats({organization_id})

				if (dbSize && dbSize.collections) {
					delete dbSize['$clusterTime'];
					self.crud.createDocument({
						collection: 'metrics',
						document: {
							date,
							in_size: inSize,
							out_size: outSize,
							memorySize,
							client_cnt: item.client_cnt,
							dbSize,
							type: 'crud',
						},
						organization_id
					});
				}
			}
		})
		this.__refresh();
	}

}

module.exports = CoCreateMetrics;
