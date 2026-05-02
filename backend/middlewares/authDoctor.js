import jwt from 'jsonwebtoken'

//doctor authentication middleware
const authDoctor = async (req,res, next) => {
    try {
        
        const {dtoken} = req.headers
        if (!dtoken) {
            return res.json({success:false, message:"Not Autherized Login Again"})
        }
        const token_decode = jwt.verify(dtoken,process.env.JWT_SECRET)


        //req.user = { id: token_decode.id }; 
        req.docId = token_decode.id  //real
        //req.docId = { id: token_decode.id };  //chatgpt
        next()
    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message})
    }
}

export default authDoctor