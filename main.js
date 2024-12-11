const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const {format} = require("url");

//const electronReload = require("electron-reload");
const { spawn } = require('child_process');
const {join} = require("path");
const path = require("path");
const url = require("url");
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, 'preload.js'),
            // devTools: true
        },
    });

    // win.loadURL('http://localhost:5173');
    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5176');
        console.log("PATH FILE: ", app.getAppPath());
        console.log("PATH FILE BINARY: ", process.execPath);
    } else {
        console.log("tuka sme")
        win.loadURL(url.format({

            pathname: join(__dirname, '/gazeProReact/dist/index.html'),
            protocol: 'file:',
            slashes: true
        }));
    }
     //electronReload(__dirname, {});
    // Open DevTools for debugging
    win.webContents.openDevTools();

    /*
        CODE FOR SYSTEM TESTING
     */
    // const csvFilePath = path.join('/Users/bobanboshevski/FERI IPT/Tretji letnik/Zagotavljanje kakovosti/vaje/naloga5-sistemskoTestiranje', 'gazeProSystemMetrics.csv');
    // if (!fs.existsSync(csvFilePath)) {
    //     fs.writeFileSync(csvFilePath, 'Timestamp,PID,Process Type,Service Name,Name,CPU Percent,Memory (MB),Creation Time,Formatted Creation Time,Sandboxed,Integrity Level\n');
    // }
    //
    // setInterval(() => {
    //     const metrics = app.getAppMetrics();
    //     let totalCpuUsage = 0;
    //     let totalMemoryUsage = 0;
    //
    //     metrics.forEach((metric) => {
    //         console.log('Process Type:', metric.type);
    //         console.log('CPU Percent:', metric.cpu.percentCPUUsage.toFixed(2));
    //         // console.log('Memory (MB):', (metric.memory.privateBytes / (1024 * 1024)).toFixed(2));
    //         console.log('Memory (MB):', (metric.memory.workingSetSize / (1024 * 1024)).toFixed(2));
    //         console.log('---');
    //
    //         const timestamp = new Date().toISOString();
    //         const pid = metric.pid;
    //         const processType = metric.type;
    //         const serviceName = metric.serviceName || 'N/A';
    //         const name = metric.name || 'N/A';
    //         const cpuPercent = metric.cpu.percentCPUUsage.toFixed(2);
    //         const memoryMB = (metric.memory.workingSetSize / (1024)).toFixed(2);
    //         //const memoryMB = (metric.memory.workingSetSize / (1024 * 1024)).toFixed(2);
    //         const creationTime = metric.creationTime || 'N/A';
    //         const formattedCreationTime = creationTime !== 'N/A' ? new Date(creationTime).toLocaleString() : 'N/A';
    //
    //         const sandboxed = metric.sandboxed || false;
    //         const integrityLevel = metric.integrityLevel || 'N/A';
    //
    //         // const csvRow = `${timestamp},${processType},${cpuPercent},${memoryMB}\n`;
    //         // const csvRow = `${timestamp},${pid},${processType},${serviceName},${name},${cpuPercent},${memoryMB},${creationTime},${formattedCreationTime},${sandboxed},${integrityLevel}\n`;
    //         // fs.appendFileSync(csvFilePath, csvRow);
    //
    //         totalCpuUsage += parseFloat(cpuPercent);
    //         totalMemoryUsage += parseFloat(memoryMB);
    //
    //     });
    //
    //     const timestamp = new Date().toISOString();
    //     const totalRow = `${timestamp},N/A,Total,Total,N/A,${totalCpuUsage.toFixed(2)},${totalMemoryUsage.toFixed(2)},N/A,N/A,N/A,N/A\n`;
    //     fs.appendFileSync(csvFilePath, totalRow);
    //
    //
    // }, 1000);
    /*
        -------------------------------------------------------------------------------------------------------
     */
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

const processPDF = (filePath) => {
    return new Promise((resolve, reject) => {

        //ZA BUILD
        //const pythonProcess = spawn('python', [path.join(__dirname, '..', '/python/pdfReadPlumber.py'), filePath]);

        const pythonProcess = spawn('python', [path.join(__dirname, '/python/pdfReadPlumber.py'), filePath]);
        let dataBuffer = '';

        pythonProcess.stdout.on('data', (data) => {
            dataBuffer += data.toString();
        });
        pythonProcess.stdout.on('end', () => {
            try {
                const tables = JSON.parse(dataBuffer);
                resolve(tables);
            } catch (error) {
                console.error('Error parsing JSON data:', error);
                reject(error);
            }
        });
        pythonProcess.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });
        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
        pythonProcess.on('error', (error) => {
            console.log('Error starting Python process:', error);
            reject('Error processing the PDF');
        });
    });
};
const processModelTypeAndPatientName = (filePath) => {
    return new Promise((resolve, reject) => {
        //ZA BUILD
        //const pythonProcess = spawn('python', [path.join(__dirname, '..', '/python/ImeModelaIzPDF in ImePacientaIzPDF/KategorijaPdfInImePacientaMAIN.py'), filePath]);

        const pythonProcess = spawn('python', [path.join(__dirname, '/python/ImeModelaIzPDF in ImePacientaIzPDF/KategorijaPdfInImePacientaMAIN.py'), filePath]);

        pythonProcess.stdout.on('data', (data) => {
            const result = JSON.parse(data.toString().trim());
            resolve(result);
        });
        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
        pythonProcess.on('error', (error) => {
            console.error('Error starting Python process:', error);
            reject('Error processing the PDF');
        });
    });
};

//const pythonExecutable = join(__dirname,'./python_embedded/python_embedded/python'); //, 'python'

ipcMain.on('process-pdf', (event, filePath) => {
    const pythonProcess = spawn('python', [join(__dirname,'..','/python/pdfReadPlumber.py'), filePath]);
    let dataBuffer = '';
    pythonProcess.stdout.on('data', (data) => {
        dataBuffer += data.toString();
    });

    pythonProcess.stdout.on('end', () => {
        try {
            const tables = JSON.parse(dataBuffer);

            console.log(tables);

            event.reply('pdf-processed', tables);
        } catch (error) {
            console.error('Error parsing JSON data:', error);
        }
    });
    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });
    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
});
ipcMain.on('process-all-pdfs', async (event, filePaths) => {
    try {
        const results = [];
        for (const filePath of filePaths) {
            const pdfContentResult = await processPDF(filePath);
            results.push(pdfContentResult);
        }
        event.reply('pdfs-processed', results);
    } catch (error) {
        console.error('Error processing all PDFs:', error);
        event.reply('error', 'Error processing the PDFs');
    }
});
ipcMain.on('process-all-models', async (event, filePaths) => {
    try {
        const results = [];
        for (const filePath of filePaths) {
            const modelAndNameResult = await processModelTypeAndPatientName(filePath);
            results.push({
                category: modelAndNameResult.category,
                patientName: modelAndNameResult.patient_name,
            });
        }
        event.reply('pdfs-categorized-and-patient-name', results);
    } catch (error) {
        console.error('Error processing all PDFs:', error);
        event.reply('error', 'Error processing the PDFs');
    }
});

ipcMain.on('pdf-model-type-and-patient-name', (event, filePath) => {
    const pythonProcess = spawn('python',
        [join(__dirname, '..','/python/ImeModelaIzPDF in ImePacientaIzPDF/KategorijaPdfInImePacientaMAIN.py'), filePath]);

    pythonProcess.stdout.on('data', (data) => {

        const result = JSON.parse(data.toString().trim());
        console.log("RESULT IME I KATEGORIJA: "+ result);

        //console.log("kategorija in ime pacienta: "+ result.category + " " + result.pacient_name);

        event.reply('pdf-categorized-and-patient-name', result); //data.toString().trim()
    });
    pythonProcess.stderr.on('data', (data)=> {
        console.error(`stderror: ${data}`);
    });
    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
    pythonProcess.on('error', (error) => {
        console.error('Error starting Python process:', error);
        event.reply('error', 'Error processing the PDF');
    });
});


ipcMain.on("send-table-to-butterfly-model", (event, dataToButterflyModel) => {

    const pythonProcess = spawn('python', [join(__dirname, '/python/butterflyModel.py'),
        JSON.stringify(dataToButterflyModel.results), dataToButterflyModel.patient_name, dataToButterflyModel.filePathToSave] );

    // const pythonProcess = spawn('python', [join(__dirname, '..', '/python/butterflyModel.py'), // dodadov .. tuka
    //     JSON.stringify(dataToButterflyModel.results), dataToButterflyModel.patient_name, dataToButterflyModel.filePathToSave] );

    pythonProcess.stdout.on('data', (data) => {
        //console.log("prediction: "+ data, "type of data: ", typeof data);
        event.reply('butterfly-model-response', data.toString()); // mozebi i stringify kje treba
    });

    pythonProcess.stderr.on('data', (data) => {
       console.error('stderr: ', data.toString());
    });
    pythonProcess.on('close', (code) => {
        console.log('child process exited with code ', code);
    });
});

ipcMain.on("send-table-to-range-of-motion", (event, dataToRangeOfMotion) => {

    // const pythonProcess = spawn('python', [join(__dirname, '..' ,'/python/rangemotionModel.py'),
    //     JSON.stringify(dataToRangeOfMotion.results),dataToRangeOfMotion.patient_name,
    //     dataToRangeOfMotion.filePathToSave] );

    const pythonProcess = spawn('python', [join(__dirname, '/python/rangemotionModel.py'),
        JSON.stringify(dataToRangeOfMotion.results),dataToRangeOfMotion.patient_name,
        dataToRangeOfMotion.filePathToSave] );

    console.log("range-of-motion tabele: ", JSON.stringify(dataToRangeOfMotion.result));

    pythonProcess.stdout.on('data', (data) => {
        console.log("prediction: "+ data.toString());
        event.reply('range-of-motion-model-response', data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
       console.error('stderr: ', data.toString());
    });
    pythonProcess.on('close', (code) => {
        console.log('child process exited with code ', code);
    });
});


ipcMain.on("send-table-to-head-neck-model", (event, dataToHeadNeckRelocationModel) => {

    const pythonProcess = spawn('python', [join(__dirname, '/python/headneckModel.py'),
        JSON.stringify(dataToHeadNeckRelocationModel.results),dataToHeadNeckRelocationModel.patient_name,
        dataToHeadNeckRelocationModel.filePathToSave] );

    // const pythonProcess = spawn('python', [join(__dirname, '..', '/python/headneckModel.py'),
    //     JSON.stringify(dataToHeadNeckRelocationModel.results),dataToHeadNeckRelocationModel.patient_name,
    //     dataToHeadNeckRelocationModel.filePathToSave] );

    console.log("head-neck tabele: ", JSON.stringify(dataToHeadNeckRelocationModel.result));

    pythonProcess.stdout.on('data', (data) => {
        console.log("prediction: "+ data.toString());
        event.reply('head-neck-model-response', data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
       console.error('stderr: ', data.toString());
    });
    pythonProcess.on('close', (code) => {
        console.log('child process exited with code ', code);
    });
});

ipcMain.handle('show-save-dialog', async (event) => {
    const result = await dialog.showSaveDialog({
        title: 'Save PDF',
        defaultPath: 'results.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    return result.filePath;
});

ipcMain.handle('open-folder', async (event, filePath) => {
    const folderPath = path.dirname(filePath);
    shell.openPath(folderPath);
})

ipcMain.on('create-excel', (event) => {
    //const pythonProcess = spawn('python', [path.join(__dirname, '..', 'python/Eksel/generateExcel.py')]); // /
    const pythonProcess = spawn('python', [path.join(__dirname, '/python/Eksel/generateExcel.py')]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
});

// Handler for saving data to an Excel file
ipcMain.on('save-data-to-excel', (event, data) => {
    //const pythonProcess = spawn('python', [path.join(__dirname, '..', 'python/Eksel/saveExcelData.py'), JSON.stringify(data)]); // /
    const pythonProcess = spawn('python', [path.join(__dirname, '/python/Eksel/saveExcelData.py'), JSON.stringify(data)]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
        event.reply('save-data-to-excel-response', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        event.reply('save-data-to-excel-response', `stderr: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
});


