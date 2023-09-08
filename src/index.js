class CoCreateMetrics {
    constructor(crud) {
        this.wsManager = crud.wsManager;
        this.crud = crud;
        this.init();
    }

    init() {
        if (this.wsManager) {
            this.wsManager.on('setBandwidth', (data) => this.setBandwidth(data));
        }
    }

    async setBandwidth({ type, data, organization_id }) {
        try {
            let timeStamp = new Date();
            let dataDirection = type || 'in'
            let dataTransfered = 0;

            if (data instanceof Buffer) {
                dataTransfered = data.byteLength;
            } else if (data instanceof String || typeof data === 'string') {
                dataTransfered = Buffer.byteLength(data, 'utf8');
            } else if (typeof data === 'object') {
                const jsonString = JSON.stringify(data);
                dataTransfered = Buffer.byteLength(jsonString, 'utf8');
            }
            if (!dataTransfered || !organization_id)
                return

            dataTransfered += 1500; // bytes used for handeling transaction and balance. 
            dataTransfered = dataTransfered / 1073741824;
            dataTransfered = dataTransfered.toFixed(32);
            dataTransfered = parseFloat(dataTransfered);

            const platformOrganization = this.crud.config.organization_id
            let organization = await this.crud.send({
                method: 'read.object',
                array: 'organizations',
                object: { _id: organization_id },
                organization_id: platformOrganization
            })

            if (organization && organization.object && organization.object[0]) {
                organization = organization.object[0]
            }

            if (organization.balance <= 0) {
                this.wsManager.organizations.set(organization_id, false)
            } else
                this.wsManager.organizations.set(organization_id, true)

            let isExpired = false
            if (organization.lastDeposit) {
                let lastDeposit = new Date(organization.lastDeposit)
                isExpired = lastDeposit <= timeStamp.setFullYear(timeStamp.getFullYear() - 1)
            }

            let isResetDataTransfer = false
            if (organization.modified.on) {
                let previousTimeStamp = new Date(organization.modified.on)
                if (previousTimeStamp.getMonth() !== timeStamp.getMonth()) {
                    isResetDataTransfer = true
                    this.crud.send({
                        method: 'create.object',
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

            let rate = this.getRate(organization.dataTransfered)
            let amount = dataTransfered * rate
            amount = -amount
            amount = amount.toFixed(32)
            amount = parseFloat(amount)

            let balanceUpdate = {
                method: 'update.object',
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

            this.crud.send(balanceUpdate)

            let transaction = {
                method: 'create.object',
                array: 'transactions',
                object: {
                    organization_id,
                    type: "withdrawal", // deposit, credit, withdrawal, debit
                    amount,
                    rate,
                    dataDirection,
                    dataTransfered,
                },
                organization_id,
                timeStamp
            }

            this.crud.send(transaction);

        } catch (error) {
            console.log('Metrics error', error)
        }
    }

    getRate(totalUsage = 0) {
        const tiers = [
            { limit: 10, rate: 2 },
            { limit: 100, rate: 1 },
            { limit: 1000, rate: 0.5 },
            { limit: 10000, rate: 0.25 },
            { limit: 100000, rate: 0.12 },
        ];

        const matchingTier = tiers.find(tier => totalUsage < tier.limit);

        return matchingTier ? matchingTier.rate : 0.12;
    }

}

module.exports = CoCreateMetrics;
