import AWS from 'aws-sdk';
import sharp from 'sharp';

AWS.config.update({region: 'ap-northeast-2'});
const s3 = new AWS.S3({apiVersion: '2006-03-01'})
const snsClient = new AWS.SNS("ap-northeast-2")

export const helloFromLambdaHandler = async (event, context) => {
  // S3 이벤트에서 원본 버킷명과 파일 키 추출
  const s3SourceBucket = event.Records[0].s3.bucket.name
  const s3SourceKey = event.Records[0].s3.object.key

  console.log(s3SourceBucket) // 콘솔찍어서 지속적으로 원하는 값이 오는지 확인
  console.log(s3SourceKey)

  // 원본 버킷으로부터 파일 읽기
  const s3Object = await s3.getObject({
    Bucket: s3SourceBucket,
    Key: s3SourceKey
  }).promise()

  // 이미지 리사이즈
  const resizedData = await sharp(s3Object.Body)
    .resize(200)
    .jpeg({ mozjpeg: true })
    .toBuffer()

  // 대상 버킷으로 파일 업로드
  const s3TargetBucket = 'sam-photo-lambda-output-bucket'
  const s3TargetKey = `${s3SourceKey.split('.')[0]}_resized.jpg` // 파일명 변경
  const s3TargetParams = {
    Bucket: s3TargetBucket,
    Key: s3TargetKey,
    ContentType: 'image/jpeg',
    Body: resizedData,
      // ACL: 'public-read'  <- 얘 때문에 삽질 함...
  }
  const s3UploadResult = await s3.putObject(s3TargetParams).promise()

    //썸네일 사진 SNS 전송
  const snsService = {
    TopicArn: 'arn:aws:sns:ap-northeast-2:725343602703:sam-photo-sns',
    Subject: "Creating a Successful Thumbnail",
    Message: `https://${s3TargetBucket}.s3.ap-northeast-2.amazonaws.com/${s3TargetKey}`
}

  const value = await snsClient.publish(snsService).promise();

  console.log('썸네일 사진이 전송 되었습니다!') 

  console.log(`썸네일 사진이 성공적으로 업로드 되었습니다! : ${s3SourceKey} 에서 ${s3TargetBucket}/${s3TargetKey} 으로`)
  
  return `썸네일 사진이 성공적으로 업로드 되었습니다! : ${s3SourceKey} 에서 ${s3TargetBucket}/${s3TargetKey} 으로`
  
}