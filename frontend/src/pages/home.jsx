import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {


    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");


    const {addToUserHistory} = useContext(AuthContext);
    let handleJoinVideoCall = async () => {
        await addToUserHistory(meetingCode)
        navigate(`/${meetingCode}`)
    }

    return (
        <>

            <div className="navBar">

                <div style={{ display: "flex", alignItems: "center" }}>

                    <h2>Kollab Video Call</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                     <IconButton onClick={() => navigate("/history")}>
  <RestoreIcon sx={{ color: "white" }} />
</IconButton>

                    <p>History</p>

                    <Button onClick={() => {
                        localStorage.removeItem("token")
                        navigate("/auth")
                    }}>
                        Logout
                    </Button>
                </div>


            </div>


            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>Where Teams Meet and Ideas Flow</h2>

                        <div style={{ display: 'flex', gap: "10px" }}>
 
                             <TextField
  onChange={e => setMeetingCode(e.target.value)}
  id="outlined-basic"
  placeholder="Meeting Code"
  variant="outlined"
  InputProps={{
    style: {
      backgroundColor: "white",
      color: "black"
    }
  }}
  InputLabelProps={{
    style: {
      color: "black" 
    },
    shrink: true      
  }}
/>



                            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>

                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>
        </>
    )
}



export default withAuth(HomeComponent)