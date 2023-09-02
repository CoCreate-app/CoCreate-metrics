class CoCreateMetrics {
    constructor(crud) {
        this.wsManager = crud.wsManager;
        this.crud = crud;
        this.metrics = new Map();
        this.cycleTime = 60;
        this.init();
    }

    init() {
        if (this.wsManager) {
            this.wsManager.on('setBandwidth', (data) => this.setBandwidth(data));
            this.wsManager.on('createMetrics', (data) => this.create(data));
            this.wsManager.on('deleteMetrics', (data) => this.delete(data));
            this.wsManager.on('updateMetrics', (data) => this.update(data));
            this.wsManager.on('deleteOrg', async (organization_id) => this.metrics.delete(organization_id));
        }

        let self = this;
        this.timer = setInterval(() => {
            self.store();
        }, self.cycleTime * 1000);
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
                    item.dataIn.push(size);
                } else {
                    item.dataOut.push(size);
                }
            }

        } catch (err) {
            console.log(err)
        }
    }

    create({ organization_id, clients }) {
        if (!organization_id || organization_id == 'users') return;

        let metric = this.metrics.get(organization_id);

        if (!metric) {
            this.metrics.set(organization_id, {
                dataIn: [],
                dataOut: [],
                memory: [],
                clients
            })
        } else {
            metric.clients = clients;
        }
    }

    update({ organization_id, clients }) {
        if (!organization_id || organization_id == 'users') return;
        let metric = this.metrics.get(organization_id)
        if (metric) {
            metric['clients'] = clients;
        } else {
            this.create({ organization_id, clients })
        }
    }

    delete({ organization_id }) {
        this.metrics.delete(organization_id)
    }

    async store() {
        let date = new Date();
        let self = this;

        this.metrics.forEach(async (item, organization_id) => {
            if (organization_id) {
                let dataIn = 0, dataOut = 0, memory = 0
                dataIn = item.dataIn.reduce((a, b) => a + b, 0);
                dataOut = item.dataOut.reduce((a, b) => a + b, 0);

                let maxIn = 0, maxOut = 0, averageIn = 0, averageOut = 0

                if (dataIn > 0) {
                    averageIn = dataIn / item.dataIn.length;
                    maxIn = Math.max(...item.dataIn);
                }

                if (dataOut > 0) {
                    averageOut = dataOut / item.dataOut.length;
                    maxOut = Math.max(...item.dataOut);
                }

                memory = (dataIn + dataOut) / 2;

                let data = {
                    method: 'create.object',
                    array: 'metrics',
                    object: {
                        date,
                        dataIn,
                        dataOut,
                        memory,
                        clients: item.clients
                    },
                    organization_id
                }

                let storage = await self.crud.send({ method: 'databaseStats', organization_id })

                if (storage)
                    data.object.storage = storage.stats

                self.crud.send(data);

                item.time = new Date().toISOString();
                item.dataIn = [];
                item.dataOut = [];
                item.memory = [];

                // TODO: setBandwidth for metric sent to storage
                // this.setBandwidth({ type: 'in', data, organization_id })
                this.setBandwidth({ data, organization_id })

            }
        })

    }

    async usage() {
        const platformOrganization = crud.config.organization_id
        console.log('platformOrganization: ', platformOrganization)
    }

}

module.exports = CoCreateMetrics;
