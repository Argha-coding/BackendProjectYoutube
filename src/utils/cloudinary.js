import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        // Check if file exists before attempting upload
        if (!fs.existsSync(localFilePath)) {
            console.log("File does not exist at path:", localFilePath);
            return null;
        }

        console.log("Attempting to upload file:", localFilePath);

        // Upload file to cloudinary - use cloudinary.uploader, not cloudinary.v2.uploader
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        console.log("File uploaded successfully to Cloudinary:", response.url);

        // Remove local file after successful upload
        fs.unlinkSync(localFilePath);
        
        return response;

    } catch (error) {
        console.error("Cloudinary upload error:", error);

        // Remove local file even if upload fails (cleanup)
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        
        return null;
    }
};

export { uploadOnCloudinary };