<?php
require 'config.php';
function sendJson($arr)
{
    header('Content-Type: application/json');
    die(json_encode($arr));
}

$command = isset($_GET['command']) ? strtolower($_GET['command']) : '';

switch ($command) {
    case 'createmultipartupload': {
            $file = preg_replace("/[^A-Za-z0-9.]/", '', $_REQUEST['fileInfo']['name']);
            $file = BASE_S3_PATH.time().$file;
            $exp = time() + 300;
    		//init upload
			$upload_sig = base64_encode(hash_hmac("sha1", "POST\n\n\n$exp\n/".BUCKET_NAME.$file."?uploads", AWS_SECRET, true));
			$url = "http://s3-ap-southeast-1.amazonaws.com/".BUCKET_NAME.$file."?uploads&".
			http_build_query(array("Signature"=>$upload_sig, "Expires"=>$exp, "AWSAccessKeyId"=>AWS_KEY));
			
			$res = array("url"=>$url, "key"=>$file);
            sendJson($res);
            break;
        }
    case 'signuploadpart': {
		$parts = array();
		$numParts = $_REQUEST['numParts'];
		$file = $_REQUEST['key'];
		$upId = $_REQUEST['uploadId'];
		$exp = time() + 7200;
		for($part=1;$part<=$numParts;$part++) {
			$upload_sig = base64_encode(hash_hmac("sha1", "PUT\n\n\n$exp\n/".BUCKET_NAME.$file."?partNumber=$part&uploadId=$upId", AWS_SECRET, true));

			$url = "http://s3-ap-southeast-1.amazonaws.com/".BUCKET_NAME.$file."?". http_build_query(array("partNumber"=>$part, "uploadId"=>$upId, "Signature"=>$upload_sig, "Expires"=>$exp, "AWSAccessKeyId"=>AWS_KEY));

			$parts[] = array("index"=>$part-1, "url"=>$url);
		}
		$upload_sig = base64_encode(hash_hmac("sha1", "DELETE\n\n\n$exp\n/".BUCKET_NAME.$file."?uploadId=$upId", AWS_SECRET, true));

		$aborturl = "http://s3-ap-southeast-1.amazonaws.com/".BUCKET_NAME.$file."?". http_build_query(array("uploadId"=>$upId, "Signature"=>$upload_sig, "Expires"=>$exp, "AWSAccessKeyId"=>AWS_KEY));
		
		$exp = time() + 18000;
		$upload_sig = base64_encode(hash_hmac("sha1", "POST\n\ntext/plain; charset=UTF-8\n$exp\n/".BUCKET_NAME.$file."?uploadId=$upId", AWS_SECRET, true));

		$completeurl = "http://s3-ap-southeast-1.amazonaws.com/".BUCKET_NAME.$file."?". http_build_query(array("uploadId"=>$upId, "Signature"=>$upload_sig, "Expires"=>$exp, "AWSAccessKeyId"=>AWS_KEY));
		
		sendJson(array("parts"=>$parts, "abort"=>$aborturl, "complete"=>$completeurl));
		break;
       }
    default: {
            header(' ', true, 404);
            die('Command not understood');
            break;
        }
}
