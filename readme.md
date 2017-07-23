AWS S3 Multipart Upload from Browser
====================================

What was done here
------------------
I have written some javascript and php code to make big local files to
be uploaded in Amazon S3 server directly in chunks, so it is
resumable and recover easily from error.

The process is fairly simple. At first js requests the server to generate signed requests to directly talk to s3 server.
Then js starts to uplaod the chunks. Chunk size and number of parallel chunk uploads are configurable, however s3 requires chunk size of atleast 5MB.
Currently progress bar is updated when one chunk have finished completely, if
some good hearted fellow makes a it work smoothly, it will be great!

Yes that's all in brief.

Requirements
------------
* User need to have modern browser (with File API, Blob API, and xhr2 support)
Latest Firefox, Chromium, Opera, IE (>= 10) all can do
* PHP server (you can use any backend but mine is php server)

Motivation
----------
I have to upload some large files in Amazon S3. Which often fails. I have read about s3 multipart uploads and browser based upload to s3 using javascript and I wanted to combine both options.
After googling I found https://github.com/ienzam/s3-multipart-upload-browser However it lacked parrallel uploads and too much exposure to internal methods.

WARNING
-------
The codes are not well tested, poorly written, and kind of a mess.
You should get inspiration (!) from the code and make your own version.
Server need to have some validation which it currently lacks. Just go
though the code and you will understand the situation :p
This is just like a demonstration, you should customize it as your own
need.

How to use it
-------------
1. set the constants in config.php
2. Enable CORS in S3 bucket where you want to upload files. Essentially through web console in s3 bucket propreties->permissions set CORS to the following XML.
```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>yourdomain.com</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <ExposeHeader>Etag</ExposeHeader>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

3. Open upload.html to see demo.
Following are options can be configured when making upload object.
```
	PART_SIZE: 5 * 1024 * 1024,
	SERVER_LOC: 'server.php',
	MAX_PARALLEL_UPLOADS: 2,
	onServerError: function(){},
	onProgressChanged: function(){},
	onUploadCompleted: function(){}
```

References
-------------
1. Overview on aws multipart upload http://docs.aws.amazon.com/AmazonS3/latest/dev/mpuoverview.html
2. Multipart API http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingRESTAPImpUpload.html
3. S3 authentication of REST calls http://docs.aws.amazon.com/AmazonS3/2006-03-01/dev/RESTAuthentication.html
4. Cross Origin Request Sharing(CORS) overview https://developer.mozilla.org/en-US/docs/HTTP/Access_control_CORS
5. Enabling CORS in s3 http://docs.aws.amazon.com/AmazonS3/latest/dev/cors.html

Files
-----

* server.php - The server file, it does the creation, completion of
multipart upload. And also it signs the requests to make the browser to
upload the file parts.

* upload.js - An attempt to make an object out of the javascript part,
the smallest documentation is present in the file

* upload.html - Demonstration of upload.js, if you are too lazy, you can
use this as your starting point.

* Libraries - they are helpers. jquery, firebug_lite, etc. You should
respect their licenses.

License
-------
Actually you can think of this code on public domain :P
Just a mention or gratitude of this work is enough :)
(not needed at all though)

Contributors
------------
@hridayeshgupta - Hridayesh Gupta - https://github.com/hridayeshgupta

@thecolorblue - Brad Davis - https://github.com/thecolorblue
@ienzam - Md. Enzam Hossain - https://github.com/ienzam
