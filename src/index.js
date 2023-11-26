const fs = require('fs');

class CoCreateMetrics {
    constructor(crud) {
        this.wsManager = crud.wsManager;
        this.crud = crud;
        this.init();
    }

    init() {
        // Read memory and CPU info
        const workerId = process.env.WORKER_ID;
        const baseInterval = 1000; // Base interval, e.g., 1 second
        const delay = (workerId * baseInterval) + (this.wsManager.cluster.totalWorkers * baseInterval);
        setInterval(() => {
            this.readMetrics()
        }, delay);
    }

    readMetrics() {
        this.readMemoryInfo();
        const cpuInfo1 = this.readCpuInfo();
        setTimeout(() => {
            const cpuInfo2 = this.readCpuInfo();
            const cpuUsage = this.calculateCpuUsage(cpuInfo1, cpuInfo2);
            let cpuTotalUsage = 0
            cpuUsage.forEach(coreUsage => {
                cpuTotalUsage += coreUsage.usage
            });
            cpuTotalUsage = cpuTotalUsage / cpuUsage.length
            // console.log(`CPU usage: ${cpuTotalUsage.toFixed(2)}%}`);
        }, 1000); // 1-second interval
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
        const totalMemory = parseInt(memInfo['MemTotal'], 10);
        const availableMemory = parseInt(memInfo['MemAvailable'] || memInfo['MemFree'], 10); // Some systems use 'MemFree'
        const usedMemory = totalMemory - availableMemory;
        const usedMemoryPercentage = (usedMemory / totalMemory) * 100;

        // console.log(`Total Memory: ${totalMemory} kB`);
        // console.log(`Used Memory: ${usedMemory} kB`);
        // console.log(`Memory Usage: ${usedMemoryPercentage.toFixed(2)}%`);
    };

    // Function to read CPU info (simplified)
    readCpuInfo() {
        const cpuInfoContent = fs.readFileSync('/proc/stat', 'utf8');
        const cpuLines = cpuInfoContent.split('\n');
        const cpuInfo = cpuLines
            .filter(line => line.startsWith('cpu'))
            .map(line => {
                const parts = line.split(' ').filter(p => p.trim() !== '');
                return {
                    core: parts[0],
                    times: parts.slice(1).map(Number),
                };
            });
        return cpuInfo;
    };

    calculateCpuUsage(cpuInfo1, cpuInfo2) {
        const cpuUsage = cpuInfo1.map((coreInfo1, index) => {
            const coreInfo2 = cpuInfo2[index];
            const idle1 = coreInfo1.times[3];
            const idle2 = coreInfo2.times[3];

            const total1 = coreInfo1.times.reduce((acc, val) => acc + val, 0);
            const total2 = coreInfo2.times.reduce((acc, val) => acc + val, 0);

            const totalDiff = total2 - total1;
            const idleDiff = idle2 - idle1;

            return {
                core: coreInfo1.core,
                usage: (1 - idleDiff / totalDiff) * 100,
            };
        });

        return cpuUsage;
    }

}

module.exports = CoCreateMetrics;
