import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateRefreshAndAccessTokens  = async(userId ) => {
  try {
        const user = await User.findById(userId)

        const accessToken  = user.generateAccessToken()
        const refreshToken  = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})
      return (accessToken,refreshToken)


  } catch (error) {
    throw new ApiError(500,"something went wrong while generating Access and Refresh Tokens")
  }
}



const registerUser = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;

  console.log("email:", email);

  // Validate required fields
  if ([fullName, username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // Get file paths from multer
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  // Avatar is required
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Upload files to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar upload failed");
  }

  // Create user in database
  const user = await User.create({
    fullName, // Fixed: Missing fullName field
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  });

  // Fetch created user without sensitive fields
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // Return success response
  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  );
});

const loginUser =  asyncHandler(async (req,res) => {
  
  const{email,password,username } =req.body

  if (!username || !email) {
    throw new ApiError(400, "username or email is required")
    
  } 

    const user = await User.findOne({
    $or : [{username} ,{email}]
  })

  if (!user) {
    throw new ApiError(400,"User Not Found")
  }

   const isPasswordValid =await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401,"Invalid user credentials")
   }

   const {accessToken,refreshToken }  =await generateRefreshAndAccessTokens(user._id)

    const loggedInUser  = await User.findById(user._id).select("-password -refreshToken")

    const options = {
      httpOnly :true,
      secure : true
    }

    return res
    .status()
    .cookie("accessToken" ,accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
      new ApiResponse(200,
        {
        
          user:  loggedInUser,accessToken,refreshToken,
      },
      "User logged in Succesfully" 
    )
    )

})


const logoutUser = asyncHandler (async (req,res) => {
  
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set : {
          refreshToken : undefined

      } 
      
    },
    {
      new : true
    }
  )
const options = {
      httpOnly :true,
      secure : true
    }

    return res
    .status(200)
    .cookie("accessToken" ,options)
    .cookie("refreshToken",options)
    .json(new ApiResponse (200) ,{} , "User loggged Out")

}
)


const refreshAccessToken =  asyncHandler(async(req,res) => {

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
  if (!incomingRefreshToken) {
    throw new ApiError(400,"Unauthorised Access")

  }
try {
  
   const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  )
  
  const user = User.findById(decodedToken?._id)
  
  
  if (!user) {
      throw new ApiError(401,"Invalid Refresh Token")
  
  }
  
  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401,"Refresh Token is Expired or used")
  }
  
  const options = {
        httpOnly :true,
        secure : true
      }
  
       const {accessToken,newrefreshToken } =  await generateRefreshAndAccessTokens(user._id)
  
  
       res
       .status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",newrefreshToken,options)
      .json(
        new ApiResponse(
          200,{
            accessToken,refreshToken :newrefreshToken
          }
        )
      )
  
      
} catch (error) {
  throw new ApiError(401, error?.message || "inavalid RefreshToken")
}



})


const changeCurrentPassword = asyncHandler(async (req,res) => {
  
  const {oldPassword,newPassword} = req.body


  const user = await  User.findById(user?._id)
  const isPasswordCorrect =  await User.isPasswordCorrect(oldPassword)
if (!isPasswordCorrect) {
  
  throw new ApiError(400,"Invalid Old Password")

}

user.password = newPassword ;
await user.save({validateBeforeSave: false})

return res.
status(200)
.json(new ApiResponse(200,{},"Password Changed Succesfully"))

}) 


const getCurrentUser = asyncHandler(async (req,res) => {
  
  return res
  .status(200)
  .json( new ApiResponse( 200,req.user,"Cureent User got succesfully"))


})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});


const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is missing")
    }

    


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, " cover Image updated successfully")
    )
})







export { registerUser,
      loginUser,
      logoutUser,
      refreshAccessToken,
      changeCurrentPassword,
      getCurrentUser,
      updateUserCoverImage,
      updateUserAvatar,
      updateAccountDetails

 };