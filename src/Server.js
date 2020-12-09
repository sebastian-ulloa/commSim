import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser'
import path from 'path';
import Papa from 'papaparse';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import result from './data/result.json'
import token from './data/token.json'
import catalogsJson from './data/catalogs.json'

const app = express();
const upload = multer();
const catalogs = catalogsJson;
const runUuidFilePath = './src/data/runuuid.txt';
const catalogResultFilePath = './src/data/catalogResult.json';
const runtimeCatalogs = './src/data/runtimeCatalogs.json';

app.use(express.static(path.join(__dirname, '/build')))
app.use(bodyParser.json())

app.get('/hub/metric-api/v1/results/:uuid', async(req, res) => {
    const uuid = req.params.uuid;
    fs.readFile(runUuidFilePath, (err, data) => {
        if (err) {
            console.error(err)
            res.status(404).send()
            return
        }

        if (!data.toString('utf8')) {
            res.status(404).send()
            return
        }

        const jsonData = JSON.parse(data.toString('utf8'))
        var fileData = jsonData.fileData

        const asset = fileData.find(item => item.id == uuid)
        if (asset) {
            const resultUpdate = result;
            resultUpdate.context["15421dae-74a4-4c3c-8af1-0fd8f98a30b5"].assetName = asset.asset;

            const dataToPrint = { fileData: fileData.filter(item => item.id != uuid) }
            fs.writeFile(runUuidFilePath, JSON.stringify(dataToPrint), (e) => { if (e) console.log('Could not update run uuids: ' + e) })

            res.status(200).json(resultUpdate)
        }
    })
})

app.post('/api/v1/catalogs/imports', upload.any(), async(req, res) => {
    const csvData = req.files[0].buffer.toString('utf8')
    const rows = Papa.parse(csvData, { delimiter: ",", header: true }).data

    const updatedCatalogs = getCatalogs();
    fs.readFile(runUuidFilePath, (err, data) => {
        if (err) {
            console.error(err)
            return
        }

        var fileData = []
        if (data.toString('utf8')) {
            const jsonData = JSON.parse(data.toString('utf8'))
            fileData = jsonData.fileData
        }

        var catalogResult = []
        fs.readFile(catalogResultFilePath, (err, data2) => {
            if (err) {
                console.error(err)
                return
            }

            if (!data2.toString('utf8')) {
                const jsonCatalogResultData = JSON.parse(data2.toString('utf8'))
                catalogResult = jsonCatalogResultData.results
            }
        })

        rows.forEach(row => {
            const index = updatedCatalogs.catalogs.findIndex(catalog => catalog.name == row["catalog_name"])
            if (index !== -1) {
                const newAsset = {
                    name: row["asset_name"]
                }
                fileData.push({ id: uuidv4(), asset: row["asset_name"], catalog: row["catalog_name"] })
                catalogResult.push(createRecord(row["asset_name"], row["catalog_name"]))
                updatedCatalogs.catalogs[index].catalogs_vod_assets_attributes.push(newAsset)
            }
        })

        const dataToPrint = { fileData }

        fs.writeFile(runtimeCatalogs, JSON.stringify(updatedCatalogs), (e) => { if (e) console.log('Could not update catalogs: ' + e) })
        fs.writeFile(runUuidFilePath, JSON.stringify(dataToPrint), (e) => { if (e) console.log('Could not update run uuids: ' + e) })
        fs.writeFile(catalogResultFilePath, JSON.stringify({ catalogResult }), (e) => { if (e) console.log('Could not update catalogResult: ' + e) })
        res.status(204).send()
    })
})

app.put('/api/v1/catalogs/:catalogid', async(req, res) => {
    const catalog = getCatalogs().catalogs.find(item => item.id === req.params.catalogid)
    const assestsToDelete = req.body;
    if (catalog) {
        catalog.catalogs_vod_assets_attributes.filter(item =>
            !assestsToDelete.catalogs_vod_assets_attributes.includes(asset => asset.id == item.id && asset.destroy)
        )
        res.status(200).json(catalog)
    }
})

app.get('/api/v1/catalogs/:catalogid/results', async(req, res) => {
    const catalog = getCatalogs().catalogs.find(item => item.id === req.params.catalogid)
    var catalogResult = []
    fs.readFile(catalogResultFilePath, (err, data) => {
        if (err) {
            console.error(err)
            return
        }

        const convertedData = data.toString('utf8')
        if (convertedData) {
            const jsonCatalogResultData = JSON.parse(convertedData)
            catalogResult = jsonCatalogResultData.results
        }

        if (catalogResult && catalogResult.length > 0) {
            var result = catalogResult.filter(item => item.catalog == catalog.name)
            res.status(200).json({ result })
        } else {
            res.status(401).send()
        }
    })
})


app.get('/api/v1/catalogs/', async(req, res) => {
    res.status(200).json(getCatalogs())
})

app.post('/api/v1/heartbeats', async(req, res) => {
    res.status(204).send()
})

app.post('/api/v1/sessions/', async(req, res) => {
    res.status(201).json(token)
})

app.listen(8081, () => {
    console.log('Listening on port 8081')
})


function createRecord(id, catalog) {
    const runUuid = uuidv4()
    return {
        id: uuidv4(),
        state: "found",
        "created_at": "2020-05-13T11:25:13.607Z",
        "run_id": runUuid,
        "run_ids": [
            runUuid
        ],
        "final": true,
        catalogs_vod_asset_id: "a2d2d51a-7732-4d89-9f15-9ee49514f93f",
        vod_asset_id: "fccae61d-467c-413d-a9c7-cd2a47ef691d",
        catalog: catalog,
        name: id
    }
}

const getCatalogs = () => {
    fs.readFile(runtimeCatalogs, (err, data) => {
        if (err) {
            console.error(err)
            return
        }

        const convertedData = data.toString('utf8')
        if (convertedData) {
            return JSON.parse(convertedData)
        } else {
            return catalogs
        }
    })

    return catalogs;
}