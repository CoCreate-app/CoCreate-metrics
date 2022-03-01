
const {ObjectID} = require("mongodb");

class CoCreateBase {
	constructor(wsManager, client) {
		this.wsManager = wsManager;
		this.db = client.db('mydb');
		this.dbClient = client;
		
		this.initBase()

	}
	
	initBase() {
		if (this.wsManager) {
			this.wsManager.on('changeDB', 	(socket, data, roomInfo) => this.changeDB(socket, data, roomInfo));
		}	
	}
		
	changeDB(socket, data) {
		const dbName = data.db;
		if (!dbName) return;
		this.db = this.dbClient.db(dbName);
		return
	}
	
	getDB(namespace) {
		var dbConn;
		try {
			if (namespace && namespace != '') {
				dbConn = this.dbClient.db(namespace)
			} else {
				dbConn = this.dbClient.db('mydb');
			}
		} catch (error) {
			console.log(error)
			dbConn = this.dbClient.db('mydb');
		}
		return dbConn;
	}    
	
	getCollection(data) {
		const collectionName = data['collection'];
		try {
			const dbName = data['db'] || data['organization_id'];
			return this.getDB(dbName).collection(collectionName);
		} catch (error) {
			return this.db.collection(collectionName);		
		}
	}
}

module.exports = CoCreateBase;