class CoCreateMetrics {
    constructor(crud) {
        this.wsManager = crud.wsManager;
        this.crud = crud;
        this.init();
        this.organizations = new Map()
    }

    init() {
        if (this.wsManager) {
            this.wsManager.on('setBandwidth', (data) => this.setBandwidth(data));
        }
    }


    async setBandwidth({ type, data, organization_id }) {
        try {
            let dataTransfered = this.getBytes(data)

            if (!dataTransfered || !organization_id)
                return
            // TODO: set duration 
            let org = this.organizations.get(organization_id)
            if (!org) {
                let self = this

                org = {}
                org.debounce = setTimeout(() => {
                    self.send(org, organization_id); // Call the callback to display the count
                    self.organizations.delete(organization_id)
                }, 60000);

                org.dataTransferedIn = 0;
                org.dataTransferedInCount = 0;
                org.dataTransferedOut = 0;
                org.dataTransferedOutCount = 0;

                this.organizations.set(organization_id, org)
            }

            if (type === 'in') {
                org.dataTransferedIn = dataTransfered;
                org.dataTransferedInCount++
            } else if (type === 'out') {
                org.dataTransferedOut = dataTransfered;
                org.dataTransferedOutCount++
            } else {
                console.log('else')
            }

        } catch (error) {
            console.log('Metrics error', error)
        }
    }


    async send(org, organization_id) {
        delete org.debounce

        org.dataTransferedOut += 250
        org.dataTransferedOutCount++

        const platformOrganization = this.crud.config.organization_id
        let organization = await this.crud.send({
            method: 'object.read',
            array: 'organizations',
            object: { _id: organization_id },
            organization_id: platformOrganization
        })

        org.dataTransferedIn += this.getBytes(platformOrganization)
        org.dataTransferedInCount++

        if (organization && organization.object && organization.object[0]) {
            organization = organization.object[0]
        } else return

        //TODO: if (organization.transactionInterval) // set in global map to use with timeout 1 sec intervals to 3600 sec
        if (this.wsManager.organizations.has(organization_id)) {
            if (organization.balance <= 0) {
                this.wsManager.organizations.get(organization_id).status = false
                this.wsManager.organizations.get(organization_id).organizationBalance = false
                this.wsManager.organizations.get(organization_id).error = 'Your balance has fallen bellow 0'

            } else {
                this.wsManager.organizations.get(organization_id).status = true
                this.wsManager.organizations.get(organization_id).organizationBalance = true
                this.wsManager.organizations.get(organization_id).error = ''
            }
        }

        let timeStamp = new Date();
        let isExpired = false
        if (organization.lastDeposit) {
            let lastDeposit = new Date(organization.lastDeposit)
            isExpired = lastDeposit <= timeStamp.setFullYear(timeStamp.getFullYear() - 1)
        }

        let isResetDataTransfer = false
        if (organization.modified && organization.modified.on) {
            let previousTimeStamp = new Date(organization.modified.on)
            if (previousTimeStamp.getMonth() !== timeStamp.getMonth()) {
                isResetDataTransfer = true
                this.crud.send({
                    method: 'object.create',
                    array: 'transactions',
                    object: {
                        organization_id,
                        type: "withdrawal", // deposit, credit, withdrawal, debit
                        dataTransfered: organization.dataTransfered,
                        previousTimeStamp
                    },
                    organization_id: platformOrganization,
                    timeStamp
                });
                organization.dataTransfered = 0
            }
        }

        let dataTransfered = org.dataTransferedIn + org.dataTransferedOut
        dataTransfered = dataTransfered / 1073741824;
        dataTransfered = dataTransfered.toFixed(32);
        dataTransfered = parseFloat(dataTransfered);

        let rate = this.getRate(organization.dataTransfered)
        let amount = dataTransfered * rate
        amount = -amount
        amount = amount.toFixed(32)
        amount = parseFloat(amount)

        let balanceUpdate = {
            method: 'object.update',
            array: 'organizations',
            object: { _id: organization_id },
            organization_id: platformOrganization,
            timeStamp
        }

        if (isExpired)
            balanceUpdate.object['balance'] = 0
        else
            balanceUpdate.object.$inc = { balance: amount }

        if (isResetDataTransfer)
            balanceUpdate.object['dataTransfered'] = 0
        else if (!balanceUpdate.object.$inc)
            balanceUpdate.object.$inc = { dataTransfered }
        else
            balanceUpdate.object.$inc.dataTransfered = dataTransfered

        // console.log('balanceUpdate: ', balanceUpdate)

        this.crud.send(balanceUpdate)

        let transaction = {
            method: 'object.create',
            array: 'transactions',
            object: {
                organization_id,
                type: "withdrawal", // deposit, credit, withdrawal, debit
                amount,
                rate,
                dataTransfered,
                ...org
            },
            organization_id,
            timeStamp
        }

        this.crud.send(transaction);

    }

    getBytes(data) {
        if (typeof data === 'number')
            return data;
        else if (data instanceof Buffer)
            return data.byteLength || 0;
        else if (data instanceof String || typeof data === 'string')
            return Buffer.byteLength(data, 'utf8') || 0;
        else if (typeof data === 'object')
            return Buffer.byteLength(JSON.stringify(data), 'utf8') || 0;
        else return 0
    }

    getRate(totalUsage = 0) {
        const tiers = [
            { limit: 10, rate: 4 },
            { limit: 100, rate: 2 },
            { limit: 1000, rate: 1 },
            { limit: 10000, rate: 0.5 },
            { limit: 100000, rate: 0.25 }
        ];

        const matchingTier = tiers.find(tier => totalUsage < tier.limit);

        return matchingTier ? matchingTier.rate : 0.12;
    }

}

module.exports = CoCreateMetrics;
