//
// node --max-old-space-size=8192 app.js compress /home/jairo/doctrine.png /home/jairo/hello.zip 5 doctrine.json
//
const fs = require('fs');

let obj = {};
let final = [];
let memory = [];
let countertick = 0;
let countertickglobal = 0;
let comparations = 0;
let findings = 0;
let mappings = 0;
let totalCoincidences = 0;
let globalStep = 0;

if (process.argv[2] == 'compress') {
    compress(process.argv[3], process.argv[4], process.argv[5], (r) => {
        fs.writeFile(process.argv[6], JSON.stringify(r, null, 4));
    });
}

if (process.argv[2] == 'decompress') {
    let json = JSON.parse(fs.readFileSync('test.json', 'utf8'));
    decompress(json, process.argv[3], 'test.j');
}


//Functions

function decompress(target, dataSource, name) {
    let wstream = fs.createWriteStream(name);
    memory = [];
    readChunky(dataSource, 1, (chunk) => {
        memory.push({
            chunk: chunk
        });
    }).then(() => {
        target.forEach((d) => {
            for (let i = 0; i < d.size; i++) {
                if (memory[d.position + i]) {
                    wstream.write(memory[d.position + i].chunk);
                }
            }
        });
        wstream.end();
    });
}

function compress(target, dataSource, step, cb, debug) {
    debug = debug || true;
    final = [];
    memory = [];

    readChunky(target, 1, (chunk) => {
        final.push({
            chunk: chunk,
            got: false
        });
    }).then(() => {
        fusion(target, dataSource, step, debug, cb);
    });
}

function fusion(file1, file2, step, debug, cb) {
    globalStep = step;
    step = parseInt(step);
    mem();
    readChunky(file1, step, (chunk) => {
        memory.push({
            chunk: chunk,
            got: false
        });
    }).then(() => {
        let coincidences = 0;
        let counter = 0;

        readChunky(file2, step, (chunk) => {
            if (compare(chunk, counter, step)) {
                totalCoincidences++;
                coincidences++;
            }
            counter++;
        }).then(() => {
            memory.forEach((c) => {
                mappings++;
                if (c.got.lock && !final[memory.indexOf(c)].got.lock) {
                    final[memory.indexOf(c)] = c;
                }
            });
            memory = [];
            if (step > 1) {
                fusion(file1, file2, --step, debug, cb);
            } else {
                let res = final.map((r) => {
                    if (r.got.size) {
                        return {
                            index: final.indexOf(r),
                            position: r.got.position,
                            size: r.got.size
                        };
                    }
                });
                cb(cleanArray(res));
            }
        });
    });
}


function readChunky(file, step, cb, end) {
    var success = function(c) {};
    var error = function(c) {};
    //Promise
    fs.open(file, 'r', function(err, fd) {
        if (err)
            throw err;
        chunkychunky(fd, step, cb, success);
    });
    //Promise
    return {
        then: function(cb) {
            success = cb;
            return this;
        },
        error: function(cb) {
            error = cb;
            return this;
        }
    };
}

function chunkychunky(fd, step, cb, success) {
    var buffer = new Buffer(step);
    var num = fs.readSync(fd, buffer, 0, step, null);
    if (num === 0) {
        success();
    } else {
        cb(buffer);
        setImmediate(() => {
            chunkychunky(fd, step, cb, success);
        });
    }
}

function cleanArray(actual) {
    var newArray = new Array();
    for (var i = 0; i < actual.length; i++) {
        if (actual[i]) {
            newArray.push(actual[i]);
        }
    }
    return newArray;
}

function compare(chunk, position, size, cb) {
    comparations++;
    let res = false;
    memory.forEach((c) => {
        let jump = false;
        findings++;
        if (c.chunk.equals(chunk) && !c.got.lock) {
            for (let x = 0; x < size; x++) {
                if (final[memory.indexOf(c) + x] && final[memory.indexOf(c) + x].got.lock) {
                    jump = true;
                }
            }
            if (!jump) {
                c.got = {
                    position: position,
                    size: size,
                    lock: true
                };
                res = true;
                for (let x = 0; x < size; x++) {
                    if (memory[memory.indexOf(c) + x]) {
                        if (!memory[memory.indexOf(c) + x].got) {
                            memory[memory.indexOf(c) + x].got = {
                                lock: true
                            };
                        } else {
                            memory[memory.indexOf(c) + x].got.lock = true;
                        }
                    }
                }
            }
        }
    });
    return res;
}


mem(true);

function mem(repeat) {
    repeat = repeat || false;
    let me = (Math.floor(process.memoryUsage().rss / 1000 / 1000));
    process.stdout.write('\033c');
    console.log('Memory: ' + me + 'MB' + "\n");
    console.log(`Step: ${globalStep}`);
    console.log(`Final: ${final.length}`);
    console.log(`Memory: ${memory.length}`);
    console.log(`Comparations: ${comparations}`);
    console.log(`Coincidences: ${totalCoincidences}`);
    console.log(`Findings: ${findings}`);
    console.log(`Mappings: ${mappings}`);
    if (repeat) {
        setTimeout(() => {
            mem(true);
        }, 200);
    }
}
