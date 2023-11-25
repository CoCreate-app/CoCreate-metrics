const fs = require('fs');

class CoCreateMetrics {
    constructor(crud) {
        this.wsManager = crud.wsManager;
        this.crud = crud;
        this.init();
    }

    init() {
        // Read memory and CPU info
        setInterval(() => {
            this.readMemoryInfo();
            this.readCpuInfo();
        }, 1000);
    }

    // Function to parse and display memory info
    readMemoryInfo() {
        const memInfoContent = fs.readFileSync('/proc/meminfo', 'utf8');
        const memInfoLines = memInfoContent.split('\n');
        const memInfo = memInfoLines.reduce((info, line) => {
            const parts = line.split(':');
            if (parts.length === 2) {
                info[parts[0].trim()] = parts[1].trim();
            }
            return info;
        }, {});
        console.log('Memory Info:', memInfo);
    };

    // Function to read CPU info (simplified)
    readCpuInfo() {
        const cpuInfoContent = fs.readFileSync('/proc/stat', 'utf8');
        const cpuLines = cpuInfoContent.split('\n');
        const cpuLine = cpuLines.find(line => line.startsWith('cpu '));
        if (cpuLine) {
            // Example processing; more needed for actual CPU usage calculation
            const cpuTimes = cpuLine.split(' ').slice(1).map(Number);
            console.log('CPU Times:', cpuTimes);
        }
    };

}

module.exports = CoCreateMetrics;
