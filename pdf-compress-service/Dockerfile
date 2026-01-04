FROM public.ecr.aws/lambda/nodejs:20@sha256:87d01448f44170e4d319343c983d8a4535499a5f02f61bf44bbe3f0561e29553

# Install Ghostscript on Amazon Linux 2023 base image
RUN microdnf update -y \
    && microdnf install -y ghostscript \
    && microdnf clean all

WORKDIR /var/task

# Dependencies for AWS SDK v3
COPY package.json ./
RUN npm install --only=production

# Copy Lambda handler
COPY lambda.js ./

# Set the Lambda handler (file.export)
CMD ["lambda.handler"]
