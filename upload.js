/**
 * S3MultiUpload Object
 * Create a new instance with new S3MultiUpload(file, config)
 * To start uploading, call start()
 * You can pause with pause()
 * Resume with resume()
 * Cancel with cancel()
 *
 * config can take these fields
 * PART_SIZE: 5 * 1024 * 1024, //minimum part size defined by aws s3
 * SERVER_LOC: 'server.php', //location of the server
 * MAX_PARALLEL_UPLOADS: 2,
 * onServerError : function(command, jqXHR, textStatus, errorThrown) {}
 * onS3UploadError : function(xhr) {}
 * onProgressChanged : function(uploadingSize, uploadedSize, totalSize) {}
 * onUploadCompleted : function() {}
 *
 * @param {type} file
 * @returns {MultiUpload}
 */
function S3MultiUpload(file, conf) {
    var state = this.consts.NOT_STARTED;
	var config = $.extend({}, this.defaultConfig, conf);
    var file = file;
    var fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
		numParts: Math.ceil(file.size/config.PART_SIZE),
        lastModifiedDate: file.lastModifiedDate,
		uploaded: 0,
		uploading: 0
    };
	var s3Key = null;//key(path) where file will be uploaded at s3
	var uploadId = null;//s3 multipart upload key
    var uploadedSize = 0;
    var uploadingSize = 0;
    var uploadInfo = [];
	var abortInfo = null;
    this.progress = [];

    if (console && console.log) {
        this.log = console.log;
    } else {
        this.log = function() {
        };
    }
	/** private */
	var self = this;
	var initiateS3MultipartUpload = function() {
		state = self.consts.PREPARING;
		console.log(config.SERVER_LOC);
		$.ajax({
			url: config.SERVER_LOC,
			type: "GET",
			data: {command: 'CreateMultipartUpload', fileInfo: fileInfo},
			success: function(data, status, jqXHR) {
				s3Key = data.key;
				console.log(data);
				$.ajax({
					url: data.url,
					type: "POST",
					success: function(res) {
						//check and verify response
						uploadId = $(res).find('UploadId').html();
						prepareUpload();
					},
					error: function(jqXHR, textStatus, errorThrown) {
						state = self.consts.ERROR;
						config.onServerError('CreateMultipartUpload', jqXHR, textStatus, errorThrown);
					}
				});
			},
			error: function(jqXHR, textStatus, errorThrown) {
				state = self.consts.ERROR;
				config.onServerError('CreateMultipartUpload', jqXHR, textStatus, errorThrown);
			}
		});
	};
	var prepareUpload = function() {
		$.ajax({
			url: config.SERVER_LOC,
			type: "GET",
			data: {command:'signuploadpart', key:s3Key, numParts:fileInfo.numParts, uploadId: uploadId},
			success: function(data) {
				uploadInfo = data.parts;
				abortInfo = data.abort;
				completeInfo = data.complete;
				startUpload();
			},
			error: function(jqXHR, textStatus, errorThrown) {
				state = self.consts.ERROR;
				config.onServerError('CreateMultipartUpload', jqXHR, textStatus, errorThrown);
			}
		});
	};
	var startUpload = function() {
		state = self.consts.UPLOADING;
		var blobs = self.blobs = [];
		var start = 0;
		var end, blob;
		for(var i=0;i<uploadInfo.length; i++) {
			start = config.PART_SIZE * i;
			end = Math.min(start + config.PART_SIZE, file.size);
			uploadInfo[i].blob = file.slice(start, end);
			uploadInfo[i].status = self.consts.NOT_STARTED;
			uploadInfo[i].numTry = 0;
		}
		self.numUploading = 0;
		uploadToS3();
	};
	var uploadToS3 = function() {
		if(state == self.consts.CANCELLED) return;
		for(var i=0; i<uploadInfo.length; i++) {
			if(self.numUploading >= config.MAX_PARALLEL_UPLOADS) {
				return;
			}
			if(uploadInfo[i].status == self.consts.UPLOADING || uploadInfo[i].status == self.consts.SUCCESS) continue;//0:not started, 1:progress, 2: success, 3:error
			sendToS3(uploadInfo[i].url, uploadInfo[i].blob, i);
			self.numUploading++;
		}
		if(self.numUploading < 1) {
			completeMultipartUpload();
		}
	};
	var sendToS3 = function(url, blob, index) {
		if(state == self.consts.CANCELLED) return;
        var size = blob.size;
		uploadInfo[index].numTry++;
		fileInfo.uploading += blob.size;
		// set part status to uploading, so it won't get uploaded again.
		uploadInfo[index].status == self.consts.UPLOADING;
		uploadInfo[index].jqHXR = $.ajax({
			url: url,
			type: "PUT",
			data: blob,
			processData: false,
			contentType: false,
			success: function(data, status, jqXHR) {
				self.log("put success", data);
				uploadInfo[index].jqHXR = null;
				uploadInfo[index].etag = jqXHR.getResponseHeader('Etag').replace('"', "");
                fileInfo.uploaded += blob.size;
				fileInfo.uploading -= blob.size;
                updateProgressBar();
				uploadInfo[index].status = self.consts.SUCCESS;
				self.numUploading--;
				uploadToS3();
			},
			error: function(a,b,c) {
				self.log("put failed",a,b,c);
				uploadInfo[index].jqHXR = null;
				uploadInfo[index].status = self.consts.ERROR;//retry later
				self.numUploading--;
				uploadToS3();
			}
		});
		uploadInfo[index].jqHXR.progress = function(a,b,c) {
			self.log("progress",a,b,c)
		};
    };
	var completeMultipartUpload = function() {
		if(state == self.consts.CANCELLED) return;
		state = self.consts.FINISHING;
		var xmlCompleteReq = "<CompleteMultipartUpload>";
		for(var i=0; i<uploadInfo.length; i++) {
			xmlCompleteReq += "<Part><PartNumber>"+(i+1)+"</PartNumber><ETag>"+uploadInfo[i].etag+"</ETag></Part>";
		}
		xmlCompleteReq += "</CompleteMultipartUpload>";
		$.ajax({
			url: completeInfo,
			type: "POST",
			processData: false,
			contentType: "text/plain; charset=UTF-8",
			data: xmlCompleteReq,
			success: function(data) {
				self.log("success complete", data);
				config.onUploadCompleted(data);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				state = self.consts.ERROR;
				config.onServerError('CompleteMultipartUpload', jqXHR, textStatus, errorThrown);
			}
		});
    };
	var updateProgressBar = function() {
        config.onProgressChanged(fileInfo.uploading, fileInfo.uploaded, fileInfo.size);
	};
	
	/*public methods */
	this.start = function() {
		if (!(window.File && window.FileReader && window.FileList && window.Blob && window.Blob.prototype.slice)) {
			config.onServerError("Browser not supported");
			return;
		}
		initiateS3MultipartUpload();
	};
	/**
     * Pause the upload
     * Remember, the current progressing part will fail,
     * that part will start from beginning (< 5MB of uplaod is wasted)
     */
    this.pause = function() {
		state = self.consts.PAUSED;
        for(var i=0; i<uploadInfo.length; i++) {
			if(uploadInfo[i].jqXHR != null) {
				uploadInfo[i].jqXHR.abort();
				uploadInfo[i].jqXHR = null;
				uploadInfo[i].state = self.consts.ERROR;
			}
		}
    };
	this.resume = function() {
		state = self.consts.UPLOADING;
		uploadToS3();
    };
	this.cancel = function() {
		var self = this;
        self.pause();
		state = self.consts.CANCELLED;
        $.ajax({
			url: abortInfo,
			type: "DELETE",
			processData: false,
			contentType: false,
			success: function(data) {
				
			},
			error: function() {
			}
		});
    };
};
S3MultiUpload.prototype.consts = {
	NOT_STARTED: 0,
	PREPARING: 1,
	UPLOADING: 2,
	PAUSED: 3,
	CANCELLED: 4,
	FINISHING: 5,
	SUCCESS: 6,
	ERROR: 7
};
S3MultiUpload.prototype.defaultConfig = {
	PART_SIZE: 5 * 1024 * 1024, //minimum part size defined by aws s3
	SERVER_LOC: 'server.php', //location of the server
	MAX_PARALLEL_UPLOADS: 2,
	onServerError: function(){},
	onProgressChanged: function(){},
	onUploadCompleted: function(){}
};
